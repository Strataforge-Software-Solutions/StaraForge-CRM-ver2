import { Account, currentAccount, db, env, hashOpaqueToken, hashPassword, issueSession, json, matchingTotpCounter, newTotpSecret, protectTotpSecret, revealTotpSecret, safeAccount, sameOrigin, sessionCookie, settings, signToken, verifyPassword } from './account-core'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
function googleResultRedirect(request: Request, stage: 'challenge' | 'enrollment', challenge: string) {
  const url = new URL('/', request.url)
  url.hash = new URLSearchParams({ auth_stage: stage, challenge }).toString()
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  return new Response(null, { status: 302, headers: { location: url.toString(), 'cache-control': 'no-store', 'set-cookie': `sf_google_state=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0${secure}` } })
}
function googleFailureRedirect(request: Request) {
  const url = new URL('/', request.url)
  url.hash = new URLSearchParams({ auth_error: 'google_sign_in_failed' }).toString()
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  return new Response(null, { status: 302, headers: { location: url.toString(), 'cache-control': 'no-store', 'set-cookie': `sf_google_state=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0${secure}` } })
}
async function readBody(request: Request) { return await request.json().catch(() => ({})) as Record<string, unknown> }
async function loadByEmail(email: string, workspaceId?: string) {
  const params = new URLSearchParams({ select: 'id,workspace_id,email,display_name,role,status,password_hash,totp_secret,totp_pending_secret,totp_last_verified_counter,session_version,created_at', email: `eq.${email}`, limit: '1' })
  if (workspaceId) params.set('workspace_id', `eq.${workspaceId}`)
  return ((await db(`users?${params}`)) as Account[])[0] ?? null
}
async function loadById(id: string) {
  const rows = await db(`users?select=id,workspace_id,email,display_name,role,status,password_hash,totp_secret,totp_pending_secret,totp_last_verified_counter,session_version,created_at&id=eq.${encodeURIComponent(id)}&limit=1`) as Account[]
  return rows[0] ?? null
}
async function auditEvent(workspaceId: string, actorId: string | null, targetId: string | null, action: string) {
  try { await db('user_audit_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id: workspaceId, actor_user_id: actorId, target_user_id: targetId, action }) }) }
  catch { console.error(`Could not save account audit event: ${action}`) }
}
async function admin(request: Request) {
  const user = await currentAccount(request)
  if (!user) return { response: json({ error: 'Your session expired. Sign in again.' }, 401) }
  if (!['owner', 'admin'].includes(user.role)) return { response: json({ error: 'Only workspace owners and admins can manage users.' }, 403) }
  return { user }
}
async function handle(request: Request) {
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405)
  if (!sameOrigin(request)) return json({ error: 'This request must come from the StrataForge app.' }, 403)
  const { projectUrl, key, signingSecret } = settings()
  if (!projectUrl || !key || signingSecret.length < 32) return json({ error: 'The standalone account service is not configured. Set SUPABASE_URL, SUPABASE_SECRET_KEY, and AUTH_SESSION_SECRET on the server.' }, 503)
  try {
    const body = request.method === 'POST' ? await readBody(request) : {}
    const action = String(body.action ?? new URL(request.url).searchParams.get('action') ?? '')

    if (action === 'bootstrap-status' && request.method === 'GET') {
      if (!env('AUTH_BOOTSTRAP_TOKEN')) return json({ available: false })
      const params = new URLSearchParams({ select: 'workspace_id', role: 'in.(owner,admin)', status: 'eq.active', password_hash: 'is.null' })
      const candidates = await db(`users?${params}`) as Array<{ workspace_id: string }>
      for (const workspaceId of [...new Set(candidates.map(account => account.workspace_id))]) {
        const adminParams = new URLSearchParams({ select: 'id', workspace_id: `eq.${workspaceId}`, role: 'in.(owner,admin)', password_hash: 'not.is.null', limit: '1' })
        const configuredAdmins = await db(`users?${adminParams}`) as unknown[]
        if (!configuredAdmins.length) return json({ available: true })
      }
      return json({ available: false })
    }

    if (action === 'login' && request.method === 'POST') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (!emailPattern.test(email) || email.length > 254 || password.length > 128) return json({ error: 'Enter a valid email and password.' }, 400)
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
      const rateKey = await hashOpaqueToken(`password:${email}:${ip}`)
      const allowed = await db('rpc/register_auth_login_attempt', { method: 'POST', body: JSON.stringify({ target_hash: rateKey }) }) as boolean
      if (!allowed) return json({ error: 'Too many sign-in attempts. Wait 15 minutes and try again.' }, 429)
      const account = await loadByEmail(email)
      if (!account || !['active', 'mfa_setup'].includes(account.status) || !await verifyPassword(password, account.password_hash)) return json({ error: 'Email or password is incorrect, or this account needs administrator setup.' }, 401)
      await db('rpc/clear_auth_login_attempts', { method: 'POST', body: JSON.stringify({ target_hash: rateKey }) })
      if (account.totp_secret) {
        const challenge = await signToken({ purpose: 'mfa', sub: account.id, wid: account.workspace_id }, 5)
        return json({ stage: 'challenge', challengeToken: challenge })
      }
      const secret = newTotpSecret()
      await db(`users?id=eq.${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify({ totp_pending_secret: await protectTotpSecret(secret), totp_last_verified_counter: null }) })
      const challenge = await signToken({ purpose: 'enroll', sub: account.id, wid: account.workspace_id }, 10)
      const label = encodeURIComponent(`StrataForge CRM:${account.email}`)
      const uri = `otpauth://totp/${label}?secret=${secret}&issuer=StrataForge%20CRM&algorithm=SHA1&digits=6&period=30`
      return json({ stage: 'enrollment', challengeToken: challenge, secret, uri })
    }

    if (action === 'verify-mfa' && request.method === 'POST') {
      const token = typeof body.challengeToken === 'string' ? body.challengeToken : ''
      const { readToken } = await import('./account-core')
      const claims = await readToken(token)
      if (!claims || !['mfa', 'enroll'].includes(String(claims.purpose)) || typeof claims.sub !== 'string') return json({ error: 'This sign-in step expired. Start again.' }, 401)
      const account = await loadById(claims.sub)
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
      const rateKey = await hashOpaqueToken(`mfa:${account?.id ?? claims.sub}:${ip}`)
      const allowed = await db('rpc/register_auth_login_attempt', { method: 'POST', body: JSON.stringify({ target_hash: rateKey }) }) as boolean
      if (!allowed) return json({ error: 'Too many authenticator attempts. Wait 15 minutes and start sign-in again.' }, 429)
      const enrolling = claims.purpose === 'enroll'
      const counter = account ? await matchingTotpCounter(await revealTotpSecret(enrolling ? account.totp_pending_secret : account.totp_secret), String(body.code ?? '')) : null
      if (!account || !['active', ...(enrolling ? ['mfa_setup'] : [])].includes(account.status) || counter === null || counter <= Number(account.totp_last_verified_counter ?? -1)) return json({ error: 'That authenticator code is incorrect or already used. Try again.' }, 401)
      const consumed = await db('rpc/consume_totp_counter', { method: 'POST', body: JSON.stringify({ target_user: account.id, next_counter: counter }) }) as boolean
      if (!consumed) return json({ error: 'That authenticator code was already used. Wait for a new code and try again.' }, 401)
      await db('rpc/clear_auth_login_attempts', { method: 'POST', body: JSON.stringify({ target_hash: rateKey }) })
      if (enrolling) await db(`users?id=eq.${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'active', totp_secret: account.totp_pending_secret, totp_pending_secret: null }) })
      const response = json({ user: safeAccount(account), workspaceId: account.workspace_id })
      response.headers.set('set-cookie', sessionCookie(request, await issueSession(account)))
      await auditEvent(account.workspace_id, account.id, account.id, enrolling ? (account.status === 'mfa_setup' ? 'invite_activated' : 'mfa_enrolled') : 'sign_in')
      return response
    }

    if (action === 'me' && request.method === 'GET') {
      const account = await currentAccount(request)
      return account ? json({ user: safeAccount(account), workspaceId: account.workspace_id }) : json({ error: 'Your session expired. Sign in again.' }, 401)
    }

    if (action === 'logout' && request.method === 'POST') {
      const account = await currentAccount(request)
      if (account) await db(`users?id=eq.${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify({ session_version: Number(account.session_version ?? 0) + 1 }) })
      const response = json({ ok: true })
      response.headers.set('set-cookie', sessionCookie(request, '', 0))
      if (account) await auditEvent(account.workspace_id, account.id, account.id, 'sign_out')
      return response
    }

    if (action === 'bootstrap-password' && request.method === 'POST') {
      const expected = env('AUTH_BOOTSTRAP_TOKEN')
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (!expected || body.bootstrapToken !== expected) return json({ error: 'The account setup key is incorrect.' }, 403)
      if (!emailPattern.test(email) || password.length < 12 || password.length > 128) return json({ error: 'Enter an existing admin email and a password with at least 12 characters.' }, 400)
      const account = await loadByEmail(email)
      if (!account || !['owner', 'admin'].includes(account.role) || account.status !== 'active' || account.password_hash) return json({ error: 'This account cannot use first-time setup.' }, 409)
      const params = new URLSearchParams({ select: 'id', workspace_id: `eq.${account.workspace_id}`, role: 'in.(owner,admin)', password_hash: 'not.is.null', limit: '1' })
      const configuredAdmins = await db(`users?${params}`) as unknown[]
      if (configuredAdmins.length) return json({ error: 'First-admin setup has already been used. Sign in with the existing admin account or ask an admin to reset access.' }, 409)
      await db(`users?id=eq.${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify({ password_hash: await hashPassword(password) }) })
      await auditEvent(account.workspace_id, null, account.id, 'first_admin_password_initialized')
      return json({ ok: true })
    }

    if (action === 'list' && request.method === 'GET') {
      const authorization = await admin(request)
      if ('response' in authorization) return authorization.response
      const rows = await db(`users?select=id,workspace_id,email,display_name,role,status,password_hash,totp_secret,totp_pending_secret,totp_last_verified_counter,session_version,created_at&workspace_id=eq.${encodeURIComponent(authorization.user.workspace_id)}&order=created_at.asc`) as Account[]
      return json({ members: rows.map(safeAccount) })
    }

    if (action === 'reset-account' && request.method === 'POST') {
      const authorization = await admin(request)
      if ('response' in authorization) return authorization.response
      const userId = typeof body.userId === 'string' ? body.userId : ''
      const target = userId ? await loadById(userId) : null
      if (!target || target.workspace_id !== authorization.user.workspace_id) return json({ error: 'Workspace user could not be found.' }, 404)
      if (target.id === authorization.user.id) return json({ error: 'Ask another workspace administrator to reset your own account.' }, 409)
      if (target.role === 'owner' && authorization.user.role !== 'owner') return json({ error: 'Only a workspace owner can reset an owner account.' }, 403)
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
      await db(`users?id=eq.${encodeURIComponent(target.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'pending', password_hash: null, totp_secret: null, totp_pending_secret: null, totp_last_verified_counter: null, google_sub: null, invite_token_hash: await hashOpaqueToken(token), invite_expires_at: expiresAt, session_version: Number(target.session_version ?? 0) + 1 }) })
      await auditEvent(target.workspace_id, authorization.user.id, target.id, 'account_access_reset')
      return json({ setupLink: `${new URL(request.url).origin}/#invite=${token}`, email: target.email, expiresAt })
    }

    if (action === 'update-account' && request.method === 'POST') {
      const authorization = await admin(request)
      if ('response' in authorization) return authorization.response
      const userId = typeof body.userId === 'string' ? body.userId : ''
      const target = userId ? await loadById(userId) : null
      if (!target || target.workspace_id !== authorization.user.workspace_id) return json({ error: 'Workspace user could not be found.' }, 404)
      if (target.role === 'owner' && authorization.user.role !== 'owner') return json({ error: 'Only a workspace owner can edit an owner account.' }, 403)
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
      const role = body.role
      if (!emailPattern.test(email) || email.length > 254) return json({ error: 'Enter a valid email address.' }, 400)
      if (!displayName || displayName.length > 120) return json({ error: 'Enter a name between 1 and 120 characters.' }, 400)
      if (target.role === 'owner' ? role !== 'owner' : role !== 'member' && role !== 'admin') return json({ error: 'Choose a valid workspace role.' }, 400)
      const existing = await loadByEmail(email, authorization.user.workspace_id)
      if (existing && existing.id !== target.id) return json({ error: 'That email already has a workspace account.' }, 409)
      const changedEmail = email !== target.email
      await db(`users?id=eq.${encodeURIComponent(target.id)}&workspace_id=eq.${encodeURIComponent(target.workspace_id)}`, { method: 'PATCH', body: JSON.stringify({ email, display_name: displayName, role, ...(changedEmail ? { google_sub: null, session_version: Number(target.session_version ?? 0) + 1 } : {}) }) })
      await auditEvent(target.workspace_id, authorization.user.id, target.id, 'account_updated')
      return json({ ok: true })
    }

    if (action === 'set-password' && request.method === 'POST') {
      const authorization = await admin(request)
      if ('response' in authorization) return authorization.response
      const userId = typeof body.userId === 'string' ? body.userId : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const target = userId ? await loadById(userId) : null
      if (!target || target.workspace_id !== authorization.user.workspace_id) return json({ error: 'Workspace user could not be found.' }, 404)
      if (target.role === 'owner' && authorization.user.role !== 'owner') return json({ error: 'Only a workspace owner can change an owner account password.' }, 403)
      if (password.length < 12 || password.length > 128) return json({ error: 'Use a password with 12 to 128 characters.' }, 400)
      await db(`users?id=eq.${encodeURIComponent(target.id)}&workspace_id=eq.${encodeURIComponent(target.workspace_id)}`, { method: 'PATCH', body: JSON.stringify({ password_hash: await hashPassword(password), status: 'mfa_setup', totp_secret: null, totp_pending_secret: null, totp_last_verified_counter: null, session_version: Number(target.session_version ?? 0) + 1 }) })
      await auditEvent(target.workspace_id, authorization.user.id, target.id, 'account_password_changed')
      return json({ ok: true })
    }

    if (action === 'delete-account' && request.method === 'POST') {
      const authorization = await admin(request)
      if ('response' in authorization) return authorization.response
      const userId = typeof body.userId === 'string' ? body.userId : ''
      const target = userId ? await loadById(userId) : null
      if (!target || target.workspace_id !== authorization.user.workspace_id) return json({ error: 'Workspace user could not be found.' }, 404)
      if (target.id === authorization.user.id) return json({ error: 'You cannot delete your own account.' }, 409)
      if (target.role === 'owner') return json({ error: 'Workspace owner accounts cannot be deleted here.' }, 403)
      await auditEvent(target.workspace_id, authorization.user.id, target.id, 'account_deleted')
      await db(`users?id=eq.${encodeURIComponent(target.id)}&workspace_id=eq.${encodeURIComponent(target.workspace_id)}`, { method: 'DELETE' })
      return json({ ok: true })
    }

    if (action === 'invite' && request.method === 'POST') {
      const authorization = await admin(request)
      if ('response' in authorization) return authorization.response
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 120) : ''
      const role = body.role
      if (!emailPattern.test(email) || email.length > 254) return json({ error: 'Enter a valid email address.' }, 400)
      if (role !== 'member' && role !== 'admin') return json({ error: 'Choose a valid workspace role.' }, 400)
      if (await loadByEmail(email, authorization.user.workspace_id)) return json({ error: 'That email already has a workspace account.' }, 409)
      const inviteTokenBytes = crypto.getRandomValues(new Uint8Array(32))
      const inviteToken = Array.from(inviteTokenBytes, byte => byte.toString(16).padStart(2, '0')).join('')
      const inviteHash = await hashOpaqueToken(inviteToken)
      const id = crypto.randomUUID()
      const record = { id, workspace_id: authorization.user.workspace_id, email, display_name: displayName || email.split('@')[0], role, status: 'pending', password_hash: null, invite_token_hash: inviteHash, invite_expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }
      await db('users', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(record) })
      await auditEvent(authorization.user.workspace_id, authorization.user.id, id, 'user_invited')
      const setupLink = `${new URL(request.url).origin}/#invite=${inviteToken}`
      return json({ ok: true, invite: { userId: id, email, role, displayName: record.display_name, setupLink, expiresAt: record.invite_expires_at } }, 201)
    }

    if (action === 'complete-invite' && request.method === 'POST') {
      const token = typeof body.inviteToken === 'string' ? body.inviteToken : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'This invitation link is invalid. Ask an administrator for a new one.' }, 410)
      if (password.length < 12 || password.length > 128) return json({ error: 'Use a password with 12 to 128 characters.' }, 400)
      const tokenHash = await hashOpaqueToken(token)
      const rows = await db(`users?select=id,workspace_id,email,display_name,role,status,password_hash,totp_secret,totp_pending_secret,totp_last_verified_counter,session_version,created_at,invite_expires_at&status=eq.pending&invite_token_hash=eq.${encodeURIComponent(tokenHash)}&limit=1`) as Array<Account & { invite_expires_at: string }>
      const account = rows[0]
      if (!account || new Date(account.invite_expires_at).getTime() < Date.now()) return json({ error: 'This invitation link is invalid or expired. Ask an administrator for a new one.' }, 410)
      const activated = await db(`users?id=eq.${encodeURIComponent(account.id)}&status=eq.pending&invite_token_hash=eq.${encodeURIComponent(tokenHash)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ password_hash: await hashPassword(password), status: 'mfa_setup', invite_token_hash: null, invite_expires_at: null }) }) as unknown[]
      if (!activated?.length) return json({ error: 'This invitation was already used. Sign in or ask an administrator to reset access.' }, 409)
      await auditEvent(account.workspace_id, account.id, account.id, 'invitation_password_set')
      const secret = newTotpSecret()
      await db(`users?id=eq.${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify({ totp_pending_secret: await protectTotpSecret(secret), totp_last_verified_counter: null }) })
      const challenge = await signToken({ purpose: 'enroll', sub: account.id, wid: account.workspace_id }, 10)
      return json({ stage: 'enrollment', challengeToken: challenge, secret, uri: `otpauth://totp/${encodeURIComponent(`StrataForge CRM:${account.email}`)}?secret=${secret}&issuer=StrataForge%20CRM&algorithm=SHA1&digits=6&period=30` })
    }

    if (action === 'google-start' && request.method === 'GET') {
      const clientId = env('GOOGLE_CLIENT_ID')
      if (!clientId) return json({ error: 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.' }, 503)
      const state = Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('')
      const { readToken } = await import('./account-core')
      const stateToken = await signToken({ purpose: 'google-state', state }, 5)
      const redirectUri = `${new URL(request.url).origin}/api/auth?action=google-callback`
      const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state: `${state}.${stateToken}`, prompt: 'select_account' })
      const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
      return new Response(JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'set-cookie': `sf_google_state=${state}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=300${secure}` } })
    }

    if (action === 'google-callback' && request.method === 'GET') {
      const query = new URL(request.url).searchParams
      const stateValue = query.get('state') ?? ''
      const separator = stateValue.indexOf('.')
      const stateId = separator < 0 ? '' : stateValue.slice(0, separator)
      const stateToken = separator < 0 ? '' : stateValue.slice(separator + 1)
      const { readToken } = await import('./account-core')
      const stateClaims = await readToken(stateToken)
      const stateCookie = request.headers.get('cookie')?.match(/(?:^|;\s*)sf_google_state=([^;]+)/)?.[1]
      if (!stateClaims || stateClaims.purpose !== 'google-state' || stateClaims.state !== stateId || stateCookie !== stateId) return googleFailureRedirect(request)
      const redirectUri = `${new URL(request.url).origin}/api/auth?action=google-callback`
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: query.get('code') ?? '', client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: redirectUri, grant_type: 'authorization_code' }) })
      const tokenBody = await tokenResponse.json().catch(() => ({})) as { access_token?: string }
      if (!tokenResponse.ok || !tokenBody.access_token) return googleFailureRedirect(request)
      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokenBody.access_token}` } })
      const profile = await profileResponse.json().catch(() => ({})) as { sub?: string; email?: string; email_verified?: boolean; name?: string }
      if (!profileResponse.ok || !profile.email || !profile.email_verified) return googleFailureRedirect(request)
      const account = await loadByEmail(profile.email.toLowerCase())
      if (!account || !['active', 'mfa_setup'].includes(account.status)) return googleFailureRedirect(request)
      const challenge = await signToken({ purpose: account.totp_secret ? 'mfa' : 'enroll', sub: account.id, wid: account.workspace_id }, account.totp_secret ? 5 : 10)
      if (!account.totp_secret) {
        const secret = newTotpSecret()
        await db(`users?id=eq.${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify({ google_sub: profile.sub, totp_pending_secret: await protectTotpSecret(secret), totp_last_verified_counter: null }) })
        return googleResultRedirect(request, 'enrollment', challenge)
      }
      await db(`users?id=eq.${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify({ google_sub: profile.sub }) })
      return googleResultRedirect(request, 'challenge', challenge)
    }

    if (action === 'enrollment-secret' && request.method === 'GET') {
      const token = new URL(request.url).searchParams.get('challengeToken') ?? ''
      const { readToken } = await import('./account-core')
      const claims = await readToken(token)
      if (!claims || claims.purpose !== 'enroll' || typeof claims.sub !== 'string') return json({ error: 'This setup step expired. Start sign-in again.' }, 401)
      const account = await loadById(claims.sub)
      if (!account || !['active', 'mfa_setup'].includes(account.status)) return json({ error: 'This account is unavailable.' }, 403)
      const secret = await revealTotpSecret(account.totp_pending_secret)
      const label = encodeURIComponent(`StrataForge CRM:${account.email}`)
      const uri = `otpauth://totp/${label}?secret=${secret}&issuer=StrataForge%20CRM&algorithm=SHA1&digits=6&period=30`
      return json({ secret, uri, email: account.email })
    }

    return json({ error: 'Unknown account action.' }, 404)
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'The account request could not be completed.' }, 500)
  }
}

export const apiFetch = handle
export default async function handler(req: any, res: any) {
  try {
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers ?? {}) as Array<[string, string | string[] | undefined]>) {
      if (typeof value === 'string') headers.set(name, value)
      else if (Array.isArray(value)) headers.set(name, value.join(', '))
    }
    let body: string | undefined
    if (req.method !== 'GET' && req.method !== 'HEAD') body = typeof req.body === 'string' ? req.body : req.body === undefined ? undefined : JSON.stringify(req.body)
    const protocol = headers.get('x-forwarded-proto') || 'https'
    const request = new Request(new URL(req.url || '/', `${protocol}://${headers.get('host') || 'localhost'}`), { method: req.method || 'GET', headers, body })
    const response = await handle(request)
    res.statusCode = response.status
    response.headers.forEach((value, name) => res.setHeader(name, value))
    res.end(await response.text())
  } catch {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'The account service could not complete the request.' }))
  }
}
