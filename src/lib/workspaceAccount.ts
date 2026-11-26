const sessionStorageKey = 'strataforge.account.session'
export type WorkspaceSession = {
  access_token: string
  expires_at: number
  user: { id: string; email?: string; user_metadata?: { name?: string; full_name?: string; workspace_id?: string; role?: string }; [key: string]: unknown }
}
export const authChangeEvent = 'strataforge:auth-change'
export const authSessionStorageKey = sessionStorageKey

function announceAuthChange() { window.dispatchEvent(new Event(authChangeEvent)) }
function saveSession(session: WorkspaceSession | null, notify = true) {
  if (session) localStorage.setItem(sessionStorageKey, JSON.stringify(session))
  else localStorage.removeItem(sessionStorageKey)
  if (notify) announceAuthChange()
}
function readSavedSession(): WorkspaceSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(sessionStorageKey) ?? 'null') as WorkspaceSession | null
    return session && typeof session.expires_at === 'number' && session.expires_at > Date.now() / 1000 && session.user?.id ? session : null
  } catch { return null }
}
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } })
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (response.status === 401 && localStorage.getItem(sessionStorageKey)) saveSession(null)
  if (!response.ok) throw new Error(body.error ?? 'The account service could not complete the request.')
  return body
}
function makeSession(result: { user: { userId: string; email: string; displayName: string; role: string }; workspaceId: string }): WorkspaceSession {
  return { access_token: '', expires_at: Math.floor(Date.now() / 1000) + 12 * 60 * 60, user: { id: result.user.userId, email: result.user.email, user_metadata: { name: result.user.displayName, workspace_id: result.workspaceId, role: result.user.role } } }
}
export async function getCurrentSession(): Promise<WorkspaceSession | null> {
  const cached = readSavedSession()
  try {
    const result = await api<{ user: { userId: string; email: string; displayName: string; role: string }; workspaceId: string }>('/api/auth?action=me')
    const session = makeSession(result)
    saveSession(session, false)
    return session
  } catch { if (cached || localStorage.getItem(sessionStorageKey)) saveSession(null); return null }
}
export async function signInWithPassword(email: string, password: string) {
  return api<{ stage: 'challenge' | 'enrollment'; challengeToken: string; secret?: string; uri?: string }>('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'login', email, password }) })
}
export async function startGoogleSignIn() {
  const result = await api<{ url: string }>('/api/auth?action=google-start')
  window.location.assign(result.url)
}
export async function verifyTotp(_session: WorkspaceSession | null, challengeToken: string, code: string) {
  const result = await api<{ user: { userId: string; email: string; displayName: string; role: string }; workspaceId: string }>('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'verify-mfa', challengeToken, code }) })
  const session = makeSession(result)
  saveSession(session)
  return session
}
export async function completeInvite(inviteToken: string, password: string) {
  return api<{ stage: 'enrollment'; challengeToken: string; secret: string; uri: string; canDeferSetup: boolean; email: string }>('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'complete-invite', inviteToken, password }) })
}
export async function deferInviteEnrollment(challengeToken: string) {
  return api<{ ok: boolean }>('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'defer-invite-enrollment', challengeToken }) })
}
export async function setBootstrapPassword(email: string, password: string, bootstrapToken: string) {
  return api<{ ok: boolean }>('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'bootstrap-password', email, password, bootstrapToken }) })
}
export async function getBootstrapStatus() {
  return api<{ available: boolean }>('/api/auth?action=bootstrap-status')
}
export async function signOut() {
  try { await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }) }
  finally { saveSession(null) }
}
export async function readCollection<T>(session: WorkspaceSession, _workspaceId: string, key: string): Promise<T | null> {
  const result = await api<{ value: T | null }>('/api/crm-data', { method: 'POST', body: JSON.stringify({ action: 'read', key }) })
  return result.value
}
export async function writeCollection<T>(session: WorkspaceSession, _workspaceId: string, key: string, value: T, base: T | null) {
  return api<{ value: T }>('/api/crm-data', { method: 'POST', body: JSON.stringify({ action: 'write', key, value, base }) })
}
export async function apiRequest<T>(path: string, session: WorkspaceSession, init: RequestInit = {}) {
  void session
  return api<T>(path, init)
}
