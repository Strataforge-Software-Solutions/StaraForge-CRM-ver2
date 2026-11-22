import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mergeChanges, normalizeCollection, sameValue } from '../shared/crm.ts'
import { parseCsv } from '../shared/csv.ts'
import { todayKey, reportPeriod } from '../src/lib/dates.ts'

let checks = 0
function check(name, run) { run(); checks++; console.log(`PASS ${name}`) }
check('independent record edits merge', () => {
  const base = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
  assert.deepEqual(mergeChanges(base, [{ id: 'a', name: 'AA' }, base[1]], [base[0], { id: 'b', name: 'BB' }]), [{ id: 'a', name: 'AA' }, { id: 'b', name: 'BB' }])
})
check('overlapping edits reject instead of overwriting', () => assert.throws(() => mergeChanges({ name: 'A' }, { name: 'B' }, { name: 'C' }), /Another user/))
check('deletion versus edit rejects', () => assert.throws(() => mergeChanges([{ id: 'a', name: 'A' }], [], [{ id: 'a', name: 'B' }]), /Another user/))
check('JSON object field order does not cause conflicts', () => assert.ok(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })))
check('legacy identity and workflow link survive rename', () => {
  const [lead] = normalizeCollection('leads', [{ name: 'Original', email: 'a@example.test', client: 'Acme' }])
  const [renamed] = normalizeCollection('leads', [{ ...lead, name: 'Renamed', email: 'b@example.test' }])
  assert.equal(lead.id, renamed.id); assert.equal(lead.workflowKey, renamed.workflowKey); assert.equal(renamed.legacyName, 'Original')
})
check('CSV supports quoted commas, newlines and escaped quotes', () => assert.equal(parseCsv('name,notes\r\n"Lee, A","line one\nsaid ""yes"""')[0].notes, 'line one\nsaid "yes"'))
check('CSV rejects malformed and duplicate headers', () => { assert.throws(() => parseCsv('name,name\na,b')); assert.throws(() => parseCsv('name\n"open')) })
check('Manila date crosses UTC day correctly', () => assert.equal(todayKey(new Date('2026-11-22T18:00:00Z')), '2026-11-23'))
check('report range excludes future dates', () => { const range = reportPeriod('Last 7 days'); assert.ok(range.includes(range.end)); assert.equal(range.includes('2099-01-01'), false) })

// Bundle the real handler; substitute only the database transport, never contact a real workspace.
process.env.SUPABASE_URL = 'https://crm-test.invalid'
process.env.SUPABASE_SECRET_KEY = 'test-only-key'
process.env.AUTH_SESSION_SECRET = 'test-only-session-secret-at-least-32-characters'
const bundle = await build({ stdin: { contents: "export { apiFetch } from './api/crm-data.ts'; export { issueSession } from './api/account-core.ts'", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false })
const { apiFetch, issueSession } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const account = { id: 'admin', workspace_id: 'workspace-a', role: 'admin', status: 'active', session_version: 0, display_name: 'Test admin', email: 'admin@example.test' }
const token = await issueSession(account)
const store = new Map(); let version = 0; let race = false
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(url)
  assert.equal(parsed.hostname, 'crm-test.invalid')
  if (parsed.pathname.endsWith('/users')) return Response.json([account])
  assert.equal(parsed.searchParams.get('workspace_id') || 'eq.workspace-a', 'eq.workspace-a')
  const key = parsed.searchParams.get('collection_key')?.replace(/^eq\./, '')
  if (!init.method) return Response.json(key ? store.has(key) ? [store.get(key)] : [] : [...store.values()])
  const body = JSON.parse(init.body)
  if (init.method === 'PATCH') {
    if (race) { race = false; return Response.json([]) }
    assert.equal(parsed.searchParams.get('updated_at'), `eq.${store.get(key).updated_at}`)
    const row = { value: body.value, updated_at: String(++version) }; store.set(key, row); return Response.json([row])
  }
  if (store.has(body.collection_key)) return Response.json([])
  const row = { value: body.value, updated_at: String(++version) }; store.set(body.collection_key, row); return Response.json([row])
}
async function request(body, authenticated = true) { const response = await apiFetch(new Request('https://app.test/api/crm-data', { method: 'POST', headers: { 'content-type': 'application/json', ...(authenticated ? { cookie: `sf_session=${token}` } : {}) }, body: JSON.stringify(body) })); return { status: response.status, body: await response.json() } }
try {
  assert.equal((await request({ action: 'read', key: 'leads' }, false)).status, 401); checks++; console.log('PASS unauthenticated data requests rejected')
  const lead = { id: 'l1', name: 'Lead', email: 'lead@example.test', status: 'New Leads', workflowKey: 'w1' }
  let saved = await request({ action: 'write', key: 'leads', base: null, value: [lead] }); assert.equal(saved.status, 200)
  let base = (await request({ action: 'read', key: 'leads' })).body.value
  assert.equal((await request({ action: 'write', key: 'leads', base, value: [{ ...base[0], status: 'Won' }] })).status, 400); checks++; console.log('PASS server blocks winning without accepted proposal and deposit')
  assert.equal((await request({ action: 'write', key: 'leads', base, value: [{ ...base[0], status: 'Lost' }] })).status, 400); checks++; console.log('PASS server requires lost reason')
  saved = await request({ action: 'write', key: 'leads', base, value: [{ ...base[0], owner: 'A' }] }); assert.equal(saved.status, 200)
  saved = await request({ action: 'write', key: 'leads', base, value: [{ ...base[0], phone: '123' }] }); assert.equal(saved.status, 200); assert.equal(saved.body.value[0].owner, 'A'); checks++; console.log('PASS API merges stale independent edits')
  saved = await request({ action: 'write', key: 'leads', base, value: [{ ...base[0], owner: 'B' }] }); assert.equal(saved.status, 409); checks++; console.log('PASS API rejects stale overlapping edits')
  base = (await request({ action: 'read', key: 'leads' })).body.value; race = true
  assert.equal((await request({ action: 'write', key: 'leads', base, value: [{ ...base[0], phone: '456' }] })).status, 409); checks++; console.log('PASS API detects database race')
  store.set('projects', { value: [{ id: 'p1', name: 'Project', value: 'PHP 1000' }], updated_at: String(++version) })
  const receipt = { id: 'r1', projectId: 'p1', amount: 100, currency: 'PHP', date: '2026-11-01', note: 'Deposit' }
  assert.equal((await request({ action: 'write', key: 'payments', base: null, value: [receipt] })).status, 200)
  assert.equal((await request({ action: 'write', key: 'payments', base: [receipt], value: [] })).status, 400); checks++; console.log('PASS posted receipts cannot be removed')
  account.role = 'member'
  assert.equal((await request({ action: 'write', key: 'payments', base: [receipt], value: [receipt, { ...receipt, id: 'r2' }] })).status, 403); checks++; console.log('PASS financial writes require admin role')
  account.role = 'admin'
  assert.equal((await request({ action: 'write', key: 'workflowFiles', base: null, value: { bad: { name: 'danger.html', mime: 'text/html', data: 'data:text/html;base64,WA==' } } })).status, 413); checks++; console.log('PASS proposal attachments reject unsafe file types')
  assert.equal((await request({ action: 'write', key: 'workflowFiles', base: null, value: { pdf: { name: 'proposal.pdf', mime: 'application/pdf', data: 'data:application/pdf;base64,JVBERi0=' } } })).status, 200); checks++; console.log('PASS proposal attachment saved in workspace collection')
  const signedWithoutFile = { w1: { proposals: [{ id: 1, name: 'Website', amount: 1000, scope: 'Five page website', status: 'Accepted' }], acceptance: { proposalId: 1, method: 'Signed file', evidence: 'signed.pdf', note: 'Approved' }, deposits: [] } }
  assert.equal((await request({ action: 'write', key: 'leadWorkflows', base: null, value: signedWithoutFile })).status, 400); checks++; console.log('PASS signed acceptance requires a real attachment')
  const acceptedWorkflow = { w1: { ...signedWithoutFile.w1, acceptance: { ...signedWithoutFile.w1.acceptance, method: 'Approval message' }, deposits: [{ amount: 100, date: '2026-11-01' }] } }
  assert.equal((await request({ action: 'write', key: 'leadWorkflows', base: null, value: acceptedWorkflow })).status, 200)
  const existingProjects = (await request({ action: 'read', key: 'projects' })).body.value
  assert.equal((await request({ action: 'write', key: 'projects', base: existingProjects, value: [...existingProjects, { id: 'p2', name: 'Converted', leadId: 'l1', workflowKey: 'w1', scope: 'Different scope' }] })).status, 400); checks++; console.log('PASS converted project scope must match acceptance')
  const history = await request({ action: 'read', key: 'recordHistory' }); assert.ok(history.body.value.length >= 3); assert.ok(history.body.value.every(item => item.actor === 'Test admin')); checks++; console.log('PASS server records actor history with saved data')
} finally { globalThis.fetch = originalFetch }
console.log(`${checks} regression checks passed.`)
