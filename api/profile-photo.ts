type AuthUser = { id: string; user_metadata?: Record<string, unknown> }

const bucket = 'profile-photos'
const maxPhotoBytes = 5 * 1024 * 1024
const allowedTypes = new Map([
  ['image/jpeg', { extension: 'jpg', signature: [0xff, 0xd8, 0xff] }],
  ['image/png', { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  ['image/webp', { extension: 'webp', signature: [0x52, 0x49, 0x46, 0x46] }],
])

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
const env = (name: string) => (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name] ?? ''

function environment() {
  return {
    projectUrl: (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, ''),
    publishableKey: env('SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_ANON_KEY'),
    secretKey: env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'),
  }
}

function bearer(request: Request) {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === new URL(request.url).host } catch { return false }
}

function hasSecondFactor(token: string) {
  try {
    const payload = token.split('.')[1]
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='))) as { aal?: string }
    return claims.aal === 'aal2'
  } catch { return false }
}

async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, any>>
}

async function supabaseRequest(projectUrl: string, path: string, apiKey: string, init: RequestInit = {}, accessToken = '') {
  return fetch(`${projectUrl}${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.body && !(init.body instanceof Blob) ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  })
}

async function authenticatedMember(request: Request, projectUrl: string, publishableKey: string, secretKey: string) {
  const accessToken = bearer(request)
  if (!accessToken) return { response: json({ error: 'Sign in again to manage your profile photo.' }, 401) }
  if (!hasSecondFactor(accessToken)) return { response: json({ error: 'Verify your authenticator before changing your profile photo.' }, 403) }

  const userResponse = await supabaseRequest(projectUrl, '/auth/v1/user', publishableKey, {}, accessToken)
  const user = await readJson(userResponse) as AuthUser
  if (!userResponse.ok || !user.id) return { response: json({ error: 'Your sign-in session expired. Sign in again.' }, 401) }

  const query = new URLSearchParams({ select: 'user_id', user_id: `eq.${user.id}`, limit: '1' })
  const memberResponse = await supabaseRequest(projectUrl, `/rest/v1/workspace_members?${query}`, secretKey)
  const members = await memberResponse.json().catch(() => []) as Array<{ user_id: string }>
  if (!memberResponse.ok || !members.some(member => member.user_id === user.id)) {
    return { response: json({ error: 'You do not have access to this workspace.' }, 403) }
  }
  return { user, accessToken }
}

function safeStoragePath(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`) || path.split('/').some(part => !part || part === '.' || part === '..')) return ''
  return path.split('/').map(encodeURIComponent).join('/')
}

async function ensurePrivateBucket(projectUrl: string, secretKey: string) {
  const response = await supabaseRequest(projectUrl, '/storage/v1/bucket', secretKey, {
    method: 'POST',
    body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: maxPhotoBytes, allowed_mime_types: [...allowedTypes.keys()] }),
  })
  if (response.ok || response.status === 409) return
  const body = await readJson(response)
  if (/already exists/i.test(String(body.message ?? body.error ?? ''))) return
  throw new Error('Private profile photo storage could not be created.')
}

async function signPhotoUrl(projectUrl: string, secretKey: string, userId: string, path: string) {
  const encodedPath = safeStoragePath(userId, path)
  if (!encodedPath) throw new Error('The stored profile photo path is invalid.')
  const response = await supabaseRequest(projectUrl, `/storage/v1/object/sign/${bucket}/${encodedPath}`, secretKey, {
    method: 'POST', body: JSON.stringify({ expiresIn: 86400 }),
  })
  const body = await readJson(response)
  const signedUrl = String(body.signedURL ?? body.signedUrl ?? '')
  if (!response.ok || !signedUrl) throw new Error('The profile photo could not be loaded.')
  return signedUrl.startsWith('http') ? signedUrl : `${projectUrl}/storage/v1${signedUrl.startsWith('/') ? signedUrl : `/${signedUrl}`}`
}

async function updatePhotoPath(projectUrl: string, secretKey: string, user: AuthUser, path: string | null) {
  const metadata = { ...(user.user_metadata ?? {}) }
  if (path) metadata.avatar_path = path
  else delete metadata.avatar_path
  const response = await supabaseRequest(projectUrl, `/auth/v1/admin/users/${encodeURIComponent(user.id)}`, secretKey, {
    method: 'PUT', body: JSON.stringify({ user_metadata: metadata }),
  })
  if (!response.ok) throw new Error('The profile photo setting could not be saved.')
}

async function removePhotoObject(projectUrl: string, secretKey: string, userId: string, path: string) {
  const encodedPath = safeStoragePath(userId, path)
  if (!encodedPath) return
  const response = await supabaseRequest(projectUrl, `/storage/v1/object/${bucket}/${encodedPath}`, secretKey, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) throw new Error('The previous profile photo could not be removed.')
}

async function validateImage(file: File) {
  const type = allowedTypes.get(file.type)
  if (!type) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size < 1 || file.size > maxPhotoBytes) throw new Error('Choose an image up to 5 MB.')
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const signatureMatches = type.signature.every((value, index) => bytes[index] === value)
  const webpMatches = file.type !== 'image/webp' || String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (!signatureMatches || !webpMatches) throw new Error('The selected file does not match its image type.')
  return type
}

async function handle(request: Request) {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405)
  if (!sameOrigin(request)) return json({ error: 'This request must come from the StrataForge app.' }, 403)

  const { projectUrl, publishableKey, secretKey } = environment()
  if (!projectUrl || !publishableKey || !secretKey) return json({ error: 'Profile photos are not configured. Ask an administrator to check the server environment.' }, 503)

  try {
    const auth = await authenticatedMember(request, projectUrl, publishableKey, secretKey)
    if ('response' in auth) return auth.response
    const { user } = auth
    const metadata = user.user_metadata ?? {}
    const previousPath = typeof metadata.avatar_path === 'string' ? metadata.avatar_path : ''
    const ownPreviousPath = previousPath.startsWith(`${user.id}/`) ? previousPath : ''

    if (request.method === 'GET') {
      if (!ownPreviousPath) return json({ photoUrl: null })
      return json({ photoUrl: await signPhotoUrl(projectUrl, secretKey, user.id, ownPreviousPath) })
    }

    if (request.method === 'DELETE') {
      await updatePhotoPath(projectUrl, secretKey, user, null)
      if (ownPreviousPath) await removePhotoObject(projectUrl, secretKey, user.id, ownPreviousPath)
      return json({ photoUrl: null })
    }

    let form: FormData
    try { form = await request.formData() } catch { return json({ error: 'Choose an image to upload.' }, 400) }
    const file = form.get('photo')
    if (!(file instanceof File)) return json({ error: 'Choose an image to upload.' }, 400)
    const image = await validateImage(file)
    const path = `${user.id}/avatar.${image.extension}`

    await ensurePrivateBucket(projectUrl, secretKey)
    const uploadResponse = await supabaseRequest(projectUrl, `/storage/v1/object/${bucket}/${safeStoragePath(user.id, path)}`, secretKey, {
      method: 'POST',
      headers: { 'content-type': file.type, 'x-upsert': 'true', 'cache-control': '3600' },
      body: file,
    })
    if (!uploadResponse.ok) throw new Error('The profile photo could not be uploaded. Try another image.')

    try { await updatePhotoPath(projectUrl, secretKey, user, path) } catch (error) {
      await removePhotoObject(projectUrl, secretKey, user.id, path).catch(() => undefined)
      throw error
    }
    if (ownPreviousPath && ownPreviousPath !== path) await removePhotoObject(projectUrl, secretKey, user.id, ownPreviousPath).catch(() => undefined)
    return json({ photoUrl: await signPhotoUrl(projectUrl, secretKey, user.id, path) })
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'The profile photo could not be updated.' }, 502)
  }
}

export default { fetch: handle }
