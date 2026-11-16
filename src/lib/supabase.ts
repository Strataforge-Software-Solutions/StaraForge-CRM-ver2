const projectUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const sessionStorageKey = 'strataforge.auth.session'
const verifierStorageKey = 'strataforge.auth.pkce-verifier'
const pendingInviteStorageKey = 'strataforge.auth.pending-invite'

export type SupabaseSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  token_type?: string
  user: { id: string; email?: string; [key: string]: unknown }
}

export type WorkspaceMembership = { workspace_id: string; user_id: string; email: string; display_name: string; role: string; created_at: string }

type AuthResponse = { access_token?: string; refresh_token?: string; expires_at?: number; expires_in?: number; token_type?: string; user?: SupabaseSession['user']; error?: string; msg?: string; message?: string }

export const isSupabaseConfigured = () => Boolean(projectUrl && publishableKey)
export function inspectSupabaseConfig() {
  let validUrl = false
  try {
    const parsed = new URL(projectUrl)
    validUrl = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))
  } catch { validUrl = false }
  return {
    projectUrl: !projectUrl ? 'missing' as const : validUrl ? 'ready' as const : 'invalid' as const,
    publishableKey: !publishableKey ? 'missing' as const : publishableKey.startsWith('sb_publishable_') ? 'ready' as const : 'invalid' as const,
  }
}
export const authChangeEvent = 'strataforge:auth-change'
export const authSessionStorageKey = sessionStorageKey

function announceAuthChange() {
  window.dispatchEvent(new Event(authChangeEvent))
}

function storeSession(session: SupabaseSession | null, notify = true) {
  if (session) localStorage.setItem(sessionStorageKey, JSON.stringify(session))
  else localStorage.removeItem(sessionStorageKey)
  if (notify) announceAuthChange()
}

function savedSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(sessionStorageKey)
    if (!raw) return null
    const session = JSON.parse(raw) as SupabaseSession
    return session.access_token && session.refresh_token && session.user?.id ? session : null
  } catch {
    return null
  }
}

async function authRequest<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured. Add the project URL and publishable key.')
  const response = await fetch(`${projectUrl}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const body = await response.json().catch(() => ({})) as T & AuthResponse
  if (!response.ok) throw new Error(body.msg ?? body.message ?? body.error ?? `Supabase Auth request failed (${response.status}).`)
  return body
}

async function restRequest<T>(path: string, session: SupabaseSession, init: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.')
  const response = await fetch(`${projectUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${session.access_token}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    const error = body as { message?: string; hint?: string } | null
    throw new Error(error?.message ?? error?.hint ?? `Supabase data request failed (${response.status}).`)
  }
  return body as T
}

let refreshInProgress: Promise<SupabaseSession | null> | null = null

export async function getCurrentSession(): Promise<SupabaseSession | null> {
  const session = savedSession()
  if (!session) return null
  if (!session.expires_at || session.expires_at > Math.floor(Date.now() / 1000) + 60) return session
  if (refreshInProgress) return refreshInProgress
  refreshInProgress = authRequest<AuthResponse>('token?grant_type=refresh_token', {
    method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }),
  }).then(result => {
    if (!result.access_token || !result.refresh_token || !result.user) throw new Error('Supabase could not refresh this session. Sign in again.')
    const updated = { ...result, expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in ?? 3600) } as SupabaseSession
    storeSession(updated, false)
    return updated
  }).catch(() => { storeSession(null); return null }).finally(() => { refreshInProgress = null })
  return refreshInProgress
}

export async function signInWithPassword(email: string, password: string) {
  const result = await authRequest<AuthResponse>('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) })
  if (!result.access_token || !result.refresh_token || !result.user) throw new Error('Supabase did not return a sign-in session.')
  const session = { ...result, expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in ?? 3600) } as SupabaseSession
  storeSession(session, false)
  return session
}

function base64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach(value => { binary += String.fromCharCode(value) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function startGoogleSignIn() {
  const random = crypto.getRandomValues(new Uint8Array(48))
  const verifier = base64Url(random)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = base64Url(new Uint8Array(digest))
  localStorage.setItem(verifierStorageKey, verifier)
  const params = new URLSearchParams({ provider: 'google', redirect_to: window.location.origin, code_challenge: challenge, code_challenge_method: 's256' })
  window.location.assign(`${projectUrl}/auth/v1/authorize?${params}`)
}

export async function consumeGoogleCallback(): Promise<SupabaseSession | null> {
  const currentUrl = new URL(window.location.href)
  const queryType = currentUrl.searchParams.get('type')
  const tokenHash = currentUrl.searchParams.get('token_hash')
  if (tokenHash && queryType === 'invite') {
    const result = await authRequest<AuthResponse>('verify', { method: 'POST', body: JSON.stringify({ token_hash: tokenHash, type: 'invite' }) })
    if (!result.access_token || !result.refresh_token || !result.user) throw new Error('The invitation link is invalid or has expired. Ask an administrator to send a new invitation.')
    localStorage.setItem(pendingInviteStorageKey, 'true')
    window.history.replaceState({}, document.title, currentUrl.pathname)
    const session = { ...result, expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in ?? 3600) } as SupabaseSession
    storeSession(session, false)
    return session
  }
  const code = currentUrl.searchParams.get('code')
  const fragment = new URLSearchParams(currentUrl.hash.slice(1))
  if (code) {
    const verifier = localStorage.getItem(verifierStorageKey)
    if (!verifier) throw new Error('Google sign-in could not be verified. Start again.')
    const result = await authRequest<AuthResponse>('token?grant_type=pkce', { method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: verifier }) })
    localStorage.removeItem(verifierStorageKey)
    window.history.replaceState({}, document.title, currentUrl.pathname)
    if (!result.access_token || !result.refresh_token || !result.user) throw new Error('Supabase did not return a Google sign-in session.')
    const session = { ...result, expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in ?? 3600) } as SupabaseSession
    storeSession(session, false)
    return session
  }
  const accessToken = fragment.get('access_token')
  const refreshToken = fragment.get('refresh_token')
  if (!accessToken || !refreshToken) return null
  if (fragment.get('type') === 'invite' || queryType === 'invite') localStorage.setItem(pendingInviteStorageKey, 'true')
  const expiresIn = Number(fragment.get('expires_in') ?? 3600)
  const user = await authRequest<SupabaseSession['user']>('user', {}, accessToken)
  const session: SupabaseSession = { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn, expires_at: Math.floor(Date.now() / 1000) + expiresIn, user }
  window.history.replaceState({}, document.title, currentUrl.pathname)
  storeSession(session, false)
  return session
}

export async function signOut() {
  const session = await getCurrentSession()
  try { if (session) await authRequest('logout?scope=global', { method: 'POST' }, session.access_token) } finally { localStorage.removeItem(pendingInviteStorageKey); storeSession(null) }
}

export function isPendingWorkspaceInvite() {
  return localStorage.getItem(pendingInviteStorageKey) === 'true'
}

export function clearPendingWorkspaceInvite() {
  localStorage.removeItem(pendingInviteStorageKey)
}

export async function updateOwnPassword(session: SupabaseSession, password: string) {
  await authRequest('user', { method: 'PUT', body: JSON.stringify({ password }) }, session.access_token)
  return session
}

export function sessionAssurance(session: SupabaseSession): string {
  try {
    const encoded = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as { aal?: string }
    return payload.aal ?? 'aal1'
  } catch { return 'aal1' }
}

export async function listTotpFactors(session: SupabaseSession): Promise<Array<{ id: string; status: string; friendly_name?: string }>> {
  const user = await authRequest<{ factors?: Array<{ id: string; status: string; friendly_name?: string; factor_type?: string }> }>('user', {}, session.access_token)
  return (user.factors ?? []).filter(factor => factor.factor_type === 'totp')
}

export async function enrollTotp(session: SupabaseSession) {
  return authRequest<{ id: string; totp: { qr_code: string; secret: string; uri: string } }>('factors', {
    method: 'POST', body: JSON.stringify({ factor_type: 'totp', friendly_name: 'StrataForge CRM' }),
  }, session.access_token)
}

export async function verifyTotp(session: SupabaseSession, factorId: string, code: string, challengeId?: string) {
  const challenge = challengeId ? { id: challengeId } : await authRequest<{ id: string }>(`factors/${encodeURIComponent(factorId)}/challenge`, { method: 'POST', body: JSON.stringify({}) }, session.access_token)
  const result = await authRequest<AuthResponse>(`factors/${encodeURIComponent(factorId)}/verify`, {
    method: 'POST', body: JSON.stringify({ challenge_id: challenge.id, code }),
  }, session.access_token)
  if (!result.access_token || !result.refresh_token || !result.user) throw new Error('Supabase did not return a verified session.')
  const updated = { ...result, expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in ?? 3600) } as SupabaseSession
  storeSession(updated, false)
  return updated
}

export async function removeTotpFactor(session: SupabaseSession, factorId: string) {
  return authRequest(`factors/${encodeURIComponent(factorId)}`, { method: 'DELETE' }, session.access_token)
}

export async function getWorkspaceMembership(session: SupabaseSession): Promise<WorkspaceMembership | null> {
  const rows = await restRequest<WorkspaceMembership[]>('workspace_members?select=workspace_id,user_id,email,display_name,role,created_at&limit=1', session)
  return rows[0] ?? null
}

export async function readCollection<T>(session: SupabaseSession, workspaceId: string, key: string): Promise<T | null> {
  const params = new URLSearchParams({ select: 'value', workspace_id: `eq.${workspaceId}`, collection_key: `eq.${key}`, limit: '1' })
  const rows = await restRequest<Array<{ value: T }>>(`crm_collections?${params}`, session)
  return rows[0]?.value ?? null
}

export async function writeCollection<T>(session: SupabaseSession, workspaceId: string, key: string, value: T) {
  const response = await fetch(`${projectUrl}/rest/v1/crm_collections?on_conflict=workspace_id%2Ccollection_key`, {
    method: 'POST',
    headers: { apikey: publishableKey, Authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ workspace_id: workspaceId, collection_key: key, value }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string; hint?: string }
    throw new Error(body.message ?? body.hint ?? `Supabase data save failed (${response.status}).`)
  }
}

export const currentPublishableKey = () => publishableKey
