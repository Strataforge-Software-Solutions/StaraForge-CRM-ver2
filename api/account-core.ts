export type AccountRole = 'owner' | 'admin' | 'member'
export type Account = { id: string; workspace_id: string; email: string; display_name: string; role: AccountRole; status: 'active' | 'pending' | 'mfa_setup' | 'disabled'; password_hash: string | null; totp_secret: string | null; totp_pending_secret: string | null; totp_last_verified_counter: number | null; session_version: number; created_at: string }

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
export const env = (name: string) => (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name] ?? ''
export function settings() {
  return { projectUrl: (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, ''), key: env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'), signingSecret: env('AUTH_SESSION_SECRET') }
}
export function bearer(request: Request) { return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] ?? '' }
export function sessionToken(request: Request) { return bearer(request) || request.headers.get('cookie')?.match(/(?:^|;\s*)sf_session=([^;]+)/)?.[1] || '' }
export function sessionCookie(request: Request, token: string, maxAge = 43200) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `sf_session=${token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === new URL(request.url).host } catch { return false }
}
export async function db(path: string, init: RequestInit = {}) {
  const { projectUrl, key } = settings()
  if (!projectUrl || !key) throw new Error('The server database connection is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.')
  const response = await fetch(`${projectUrl}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } })
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new Error((body as { message?: string; hint?: string } | null)?.message ?? (body as { hint?: string } | null)?.hint ?? `Database request failed (${response.status}).`)
  return body
}
const encoder = new TextEncoder()
function b64(bytes: Uint8Array) { let value = ''; bytes.forEach(byte => { value += String.fromCharCode(byte) }); return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function unb64(value: string) { const normalized = value.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), char => char.charCodeAt(0)) }
async function hmacKey() {
  const secret = settings().signingSecret
  if (secret.length < 32) throw new Error('Set AUTH_SESSION_SECRET to a random value with at least 32 characters.')
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
export async function signToken(claims: Record<string, unknown>, minutes: number) {
  const payload = { ...claims, exp: Math.floor(Date.now() / 1000) + minutes * 60 }
  const encoded = b64(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(encoded))
  return `${encoded}.${b64(new Uint8Array(signature))}`
}
export async function readToken(token: string) {
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return null
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(), unb64(signature), encoder.encode(payload))
    if (!valid) return null
    const claims = JSON.parse(new TextDecoder().decode(unb64(payload))) as Record<string, unknown>
    if (typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) return null
    return claims
  } catch { return null }
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, key, 256)
  return `pbkdf2-sha256$310000$${b64(salt)}$${b64(new Uint8Array(derived))}`
}
export async function hashOpaqueToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return b64(new Uint8Array(digest))
}
export async function verifyPassword(password: string, value: string | null) {
  if (!value) return false
  const [scheme, rounds, salt, expected] = value.split('$')
  if (scheme !== 'pbkdf2-sha256' || Number(rounds) < 100000 || !salt || !expected) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: Number(rounds), hash: 'SHA-256' }, key, 256))
  const actual = b64(derived)
  return actual.length === expected.length && actual === expected
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function base32Decode(value: string) {
  let bits = '', out: number[] = []
  for (const char of value.toUpperCase().replace(/=+$/, '')) { const n = alphabet.indexOf(char); if (n < 0) throw new Error('Invalid authenticator secret.'); bits += n.toString(2).padStart(5, '0') }
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2))
  return new Uint8Array(out)
}
export function newTotpSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(20)); let bits = '', out = ''
  bytes.forEach(byte => { bits += byte.toString(2).padStart(8, '0') })
  for (let i = 0; i < bits.length; i += 5) out += alphabet[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]
  return out
}
export async function totpCode(secret: string, counter: number) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const message = new Uint8Array(8)
  let n = BigInt(counter)
  for (let i = 7; i >= 0; i--) { message[i] = Number(n & 255n); n >>= 8n }
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, message))
  const offset = digest[digest.length - 1] & 15
  const binary = ((digest[offset] & 127) << 24) | ((digest[offset + 1] & 255) << 16) | ((digest[offset + 2] & 255) << 8) | (digest[offset + 3] & 255)
  return String(binary % 1_000_000).padStart(6, '0')
}
export async function matchingTotpCounter(secret: string, code: string) {
  if (!/^\d{6}$/.test(code) || !secret) return null
  const counter = Math.floor(Date.now() / 30000)
  for (const delta of [-1, 0, 1]) if (await totpCode(secret, counter + delta) === code) return counter + delta
  return null
}
export async function protectTotpSecret(secret: string | null) {
  if (!secret) return null
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(settings().signingSecret))
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(secret)))
  return `enc:${b64(new Uint8Array([...iv, ...encrypted]))}`
}
export async function revealTotpSecret(secret: string | null) {
  if (!secret) return ''
  if (!secret.startsWith('enc:')) return secret
  const packed = unb64(secret.slice(4))
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(settings().signingSecret))
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: packed.slice(0, 12) }, key, packed.slice(12))
  return new TextDecoder().decode(plaintext)
}
export async function currentAccount(request: Request) {
  const claims = await readToken(sessionToken(request))
  if (!claims || typeof claims.sub !== 'string' || typeof claims.wid !== 'string') return null
  const rows = await db(`users?select=id,workspace_id,email,display_name,role,status,password_hash,totp_secret,totp_pending_secret,totp_last_verified_counter,session_version,created_at&id=eq.${encodeURIComponent(claims.sub)}&workspace_id=eq.${encodeURIComponent(claims.wid)}&limit=1`)
  const account = (rows as Account[] | null)?.[0]
  return account?.status === 'active' && Number(claims.ver ?? 0) === Number(account.session_version ?? 0) ? account : null
}
export async function issueSession(account: Account) {
  return signToken({ sub: account.id, wid: account.workspace_id, role: account.role, ver: Number(account.session_version ?? 0) }, 60 * 12)
}
export const safeAccount = (user: Account) => ({ userId: user.id, email: user.email, displayName: user.display_name, role: user.role, status: user.status, createdAt: user.created_at })
