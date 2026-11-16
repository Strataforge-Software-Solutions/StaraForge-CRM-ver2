type WorkspaceRole = 'owner' | 'admin' | 'member'
type AuthUser = { id: string; email?: string; email_confirmed_at?: string | null; confirmed_at?: string | null; last_sign_in_at?: string | null; user_metadata?: Record<string, unknown> }

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const env = (name: string) => (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name] ?? ''

function environment() {
  return {
    projectUrl: (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, ''),
    publishableKey: env('SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_ANON_KEY'),
    secretKey: env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function jwtClaims(token: string) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='))) as { aal?: string }
  } catch { return {} }
}

async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, any>>
}

function bearer(request: Request) {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === new URL(request.url).host } catch { return false }
}

async function supabaseRequest(projectUrl: string, path: string, key: string, init: RequestInit = {}, accessToken = key) {
  return fetch(`${projectUrl}${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })
}

async function getAuthUsers(projectUrl: string, secretKey: string): Promise<AuthUser[]> {
  const response = await supabaseRequest(projectUrl, '/auth/v1/admin/users?page=1&per_page=1000', secretKey)
  const body = await readJson(response)
  if (!response.ok) throw new Error('Supabase could not check the account list.')
  return Array.isArray(body.users) ? body.users as AuthUser[] : []
}

async function verifiedAdmin(request: Request, projectUrl: string, publishableKey: string, secretKey: string, workspaceId: string) {
  const accessToken = bearer(request)
  if (!accessToken) return { response: json({ error: 'Sign in again to manage workspace members.' }, 401) }

  const userResponse = await supabaseRequest(projectUrl, '/auth/v1/user', publishableKey, {}, accessToken)
  const user = await readJson(userResponse) as AuthUser
  if (!userResponse.ok || !user.id) return { response: json({ error: 'Your sign-in session expired. Sign in again.' }, 401) }
  if (jwtClaims(accessToken).aal !== 'aal2') return { response: json({ error: 'Verify your authenticator before managing workspace access.' }, 403) }

  const membershipUrl = new URL(`${projectUrl}/rest/v1/workspace_members`)
  membershipUrl.search = new URLSearchParams({ select: 'role', workspace_id: `eq.${workspaceId}`, user_id: `eq.${user.id}`, limit: '1' }).toString()
  const memberResponse = await supabaseRequest(projectUrl, `${membershipUrl.pathname}${membershipUrl.search}`, secretKey)
  const rows = await memberResponse.json().catch(() => []) as Array<{ role: WorkspaceRole }>
  if (!memberResponse.ok || !rows.length) return { response: json({ error: 'You do not have access to this workspace.' }, 403) }
  if (!['owner', 'admin'].includes(rows[0].role)) return { response: json({ error: 'Only workspace owners and admins can manage members.' }, 403) }
  return { user }
}

async function getMembers(projectUrl: string, secretKey: string, workspaceId: string) {
  const query = new URLSearchParams({ select: 'user_id,email,display_name,role,created_at', workspace_id: `eq.${workspaceId}`, order: 'created_at.asc' })
  const response = await supabaseRequest(projectUrl, `/rest/v1/workspace_members?${query}`, secretKey)
  const body = await readJson(response)
  if (!response.ok || !Array.isArray(body)) throw new Error('Workspace members could not be loaded.')

  const users = await getAuthUsers(projectUrl, secretKey)
  const usersById = new Map(users.map(user => [user.id, user]))
  return body.map((member: { user_id: string; email: string; display_name: string; role: WorkspaceRole; created_at: string }) => {
    const user = usersById.get(member.user_id)
    const confirmed = Boolean(user?.email_confirmed_at ?? user?.confirmed_at)
    return {
      email: member.email,
      displayName: member.display_name || String(user?.user_metadata?.name ?? member.email.split('@')[0]),
      role: member.role,
      status: confirmed ? 'active' : 'pending',
      createdAt: member.created_at,
    }
  })
}

async function addMembership(projectUrl: string, secretKey: string, workspaceId: string, user: AuthUser, email: string, role: Exclude<WorkspaceRole, 'owner'>) {
  const response = await supabaseRequest(projectUrl, '/rest/v1/workspace_members', secretKey, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ workspace_id: workspaceId, user_id: user.id, email, display_name: String(user.user_metadata?.name ?? ''), role }),
  })
  if (!response.ok) {
    const body = await readJson(response)
    if (response.status === 409 || body.code === '23505') throw new Error('That account is already a member of this workspace.')
    throw new Error('The invite was sent, but workspace access could not be saved. Retry the invite to finish adding this account.')
  }
}

async function handle(request: Request) {
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405)
  if (!sameOrigin(request)) return json({ error: 'This request must come from the StrataForge app.' }, 403)

  const { projectUrl, publishableKey, secretKey } = environment()
  if (!projectUrl || !publishableKey || !secretKey) {
    return json({ error: 'Invites are not configured yet. Add SUPABASE_SECRET_KEY to the Vercel project environment and redeploy.' }, 503)
  }

  const url = new URL(request.url)
  let payload: { workspaceId?: unknown; email?: unknown; role?: unknown }
  if (request.method === 'GET') {
    payload = { workspaceId: url.searchParams.get('workspaceId') }
  } else {
    try { payload = await request.json() as typeof payload } catch { return json({ error: 'Enter a valid email and role.' }, 400) }
  }
  const workspaceId = typeof payload.workspaceId === 'string' ? payload.workspaceId : ''
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return json({ error: 'Workspace could not be identified.' }, 400)

  try {
    const authorization = await verifiedAdmin(request, projectUrl, publishableKey, secretKey, workspaceId)
    if ('response' in authorization) return authorization.response

    if (request.method === 'GET') {
      return json({ members: await getMembers(projectUrl, secretKey, workspaceId) })
    }

    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const role = payload.role
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400)
    if (role !== 'member' && role !== 'admin') return json({ error: 'Choose a valid workspace role.' }, 400)

    const query = new URLSearchParams({ select: 'user_id', workspace_id: `eq.${workspaceId}`, email: `eq.${email}`, limit: '1' })
    const existingMemberResponse = await supabaseRequest(projectUrl, `/rest/v1/workspace_members?${query}`, secretKey)
    const existingMembers = await existingMemberResponse.json().catch(() => []) as unknown[]
    if (!existingMemberResponse.ok) throw new Error('Workspace membership could not be checked.')
    if (existingMembers.length) return json({ error: 'That account is already a member of this workspace.' }, 409)

    const users = await getAuthUsers(projectUrl, secretKey)
    const existingUser = users.find(user => user.email?.toLowerCase() === email)
    let invitedUser = existingUser
    let inviteSent = false
    let existingAccount = Boolean(existingUser)

    if (!invitedUser) {
      const redirectTo = env('SUPABASE_INVITE_REDIRECT_URL') || `${url.origin}/`
      const inviteUrl = new URL(`${projectUrl}/auth/v1/invite`)
      inviteUrl.searchParams.set('redirect_to', redirectTo)
      const inviteResponse = await supabaseRequest(projectUrl, `${inviteUrl.pathname}${inviteUrl.search}`, secretKey, {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      const inviteBody = await readJson(inviteResponse)
      if (!inviteResponse.ok || !inviteBody.id) {
        const message = String(inviteBody.msg ?? inviteBody.message ?? '')
        if (/already (been )?registered|already exists/i.test(message)) {
          const refreshedUsers = await getAuthUsers(projectUrl, secretKey)
          invitedUser = refreshedUsers.find(user => user.email?.toLowerCase() === email)
          existingAccount = Boolean(invitedUser)
        }
        if (!invitedUser) return json({ error: message || 'Supabase could not send the invitation. Check the project email settings and try again.' }, 502)
      } else {
        invitedUser = inviteBody as AuthUser
        inviteSent = true
      }
    }

    if (!invitedUser) return json({ error: 'Supabase did not return the invited account.' }, 502)
    await addMembership(projectUrl, secretKey, workspaceId, invitedUser, email, role)

    let confirmationResent = false
    if (existingAccount && !(invitedUser.email_confirmed_at ?? invitedUser.confirmed_at)) {
      const resendUrl = new URL(`${projectUrl}/auth/v1/resend`)
      const redirectTo = env('SUPABASE_INVITE_REDIRECT_URL') || `${url.origin}/`
      resendUrl.searchParams.set('redirect_to', redirectTo)
      const resendResponse = await supabaseRequest(projectUrl, `${resendUrl.pathname}${resendUrl.search}`, publishableKey, {
        method: 'POST',
        body: JSON.stringify({ type: 'signup', email }),
      }, publishableKey)
      confirmationResent = resendResponse.ok
    }

    return json({ ok: true, email, role, inviteSent, existingAccount, confirmationResent }, 201)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Workspace access could not be updated.'
    return json({ error: message }, 502)
  }
}

export default { fetch: handle }
