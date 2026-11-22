import { mergeChanges, normalizeCollection, sameValue } from '../shared/crm.js'
import { currentAccount, db, json, sameOrigin } from './account-core.js'

async function handle(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  if (!sameOrigin(request)) return json({ error: 'This request must come from the StrataForge app.' }, 403)
  const account = await currentAccount(request).catch(() => null)
  if (!account) return json({ error: 'Your session expired. Sign in again.' }, 401)
  const body = await request.json().catch(() => null) as { action?: string; key?: string; value?: unknown; base?: unknown } | null
  if (!body || !['read', 'write'].includes(String(body.action)) || typeof body.key !== 'string' || body.key.length < 1 || body.key.length > 160) return json({ error: 'The CRM data request is invalid.' }, 400)
  try {
    const workspaceId = encodeURIComponent(account.workspace_id)
    const key = encodeURIComponent(body.key)
    const unwrap = (value: any) => value?.__crm === 1 ? value.data : value
    const normalize = async (value: any) => {
      let result = normalizeCollection(body.key!, unwrap(value))
      if (body.key === 'leads' && Array.isArray(result) && result.some(row => !row.statusMigrated)) {
        const legacy = await db(`crm_collections?select=value&workspace_id=eq.${workspaceId}&collection_key=eq.leadStatusOverrides&limit=1`) as Array<{ value: Record<string, string> }>
        result = result.map(row => ({ ...row, status: row.statusMigrated ? row.status : unwrap(legacy[0]?.value)?.[row.id] ?? unwrap(legacy[0]?.value)?.[row.legacyName] ?? row.status, statusMigrated: true }))
      }
      if (body.key === 'projects' && Array.isArray(result)) {
        const overrides = await db(`crm_collections?select=value&workspace_id=eq.${workspaceId}&collection_key=eq.projectOverrides&limit=1`) as Array<{ value: any }>
        const patches = unwrap(overrides[0]?.value) || {}
        result = result.map(row => ({ ...row, ...(patches[row.id] || patches[row.legacyName] || {}) }))
      }
      if (Array.isArray(result) && ['leads', 'projects', 'tasks'].includes(body.key!)) {
        const target = body.key === 'tasks' ? 'projects' : 'clients'
        const field = body.key === 'tasks' ? 'project' : 'client'
        const source = await db(`crm_collections?select=value&workspace_id=eq.${workspaceId}&collection_key=eq.${target}&limit=1`) as Array<{ value: any }>
        const parents = normalizeCollection(target, unwrap(source[0]?.value) || [])
        result = result.map(row => { if (row[`${field}Id`]) { const parent = parents.find((item: any) => item.id === row[`${field}Id`]); return parent ? { ...row, [field]: parent.name } : row; } const matches = parents.filter((parent: any) => parent.name === row[field] || parent.legacyName === row[field]); return matches.length === 1 ? { ...row, [`${field}Id`]: matches[0].id } : row })
      }
      return result
    }
    if (body.key === 'recordHistory') {
      if (body.action !== 'read') return json({ error: 'History is recorded by the server.' }, 403)
      const all = await db(`crm_collections?select=value&workspace_id=eq.${workspaceId}`) as Array<{ value: any }>
      return json({ value: all.flatMap(row => row.value?.__crm === 1 ? row.value.history || [] : []).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)) })
    }
    if (body.action === 'read') {
      const rows = await db(`crm_collections?select=value&workspace_id=eq.${workspaceId}&collection_key=eq.${key}&limit=1`) as Array<{ value: unknown }>
      return json({ value: await normalize(rows?.[0]?.value ?? null) })
    }
    const serialized = JSON.stringify(body.value)
    if (!serialized || serialized.length > 5_000_000) return json({ error: 'This CRM update is too large.' }, 413)
    if (body.key === 'workflowFiles') {
      const files = body.value as Record<string, { name?: string; mime?: string; data?: string }>
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      if (!files || Array.isArray(files) || typeof files !== 'object' || serialized.length > 4_000_000 || Object.values(files).some(file => !file || typeof file.name !== 'string' || file.name.length > 120 || !allowed.includes(String(file.mime)) || typeof file.data !== 'string' || file.data.length > 1_400_000 || !file.data.startsWith(`data:${file.mime};base64,`))) return json({ error: 'Proposal files must be PDF or images up to 1 MB each (3 MB total).' }, 413)
    }

    if (!Object.prototype.hasOwnProperty.call(body, 'base')) return json({ error: 'Reload the CRM before saving with this version.' }, 409)
    const rows = await db(`crm_collections?select=value,updated_at&workspace_id=eq.${workspaceId}&collection_key=eq.${key}&limit=1`) as Array<{ value: unknown; updated_at: string }>
    let value: unknown
    try { value = mergeChanges(body.base, normalizeCollection(body.key, body.value), await normalize(rows[0]?.value ?? null), body.key) }
    catch (error) { return json({ error: (error as Error).message }, 409) }
    const loadData = async (name: string) => {
      const data = await db(`crm_collections?select=value&workspace_id=eq.${workspaceId}&collection_key=eq.${encodeURIComponent(name)}&limit=1`) as Array<{ value: unknown }>
      return unwrap(data[0]?.value)
    }
    const previous: any = await normalize(rows[0]?.value ?? null)
    if (['leads', 'clients', 'projects', 'tasks', 'payments', 'paymentSchedules', 'contacts', 'interactions'].includes(body.key)) {
      if (!Array.isArray(value) || value.some((item: any) => !item || typeof item !== 'object' || !item.id) || new Set(value.map((item: any) => item.id)).size !== value.length) return json({ error: 'Records require unique identifiers.' }, 400)
    }
    if (['payments', 'paymentSchedules'].includes(body.key)) {
      if (!['owner', 'admin'].includes(account.role)) return json({ error: 'Only admins can record payments and payment schedules.' }, 403)
      if (!Array.isArray(value) || value.some((row: any) => !row.id || !row.projectId || !Number.isFinite(row.amount) || row.amount <= 0 || !['PHP', 'USD'].includes(row.currency))) return json({ error: 'Payment records require a project, currency, and positive amount.' }, 400)
      const projects = normalizeCollection('projects', await loadData('projects') || [])
      for (const payment of value as any[]) {
        const project = projects.find((item: any) => item.id === payment.projectId)
        if (!project) return json({ error: 'Choose an existing project for this payment.' }, 400)
        const currency = project.value?.match(/^(PHP|USD)/)?.[1]
        if (currency && currency !== payment.currency) return json({ error: 'Payment currency must match the agreed project currency.' }, 400)
        const date = body.key === 'payments' ? payment.date : payment.due
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(new Date(date).getTime())) return json({ error: 'Enter a valid payment date.' }, 400)
      }
      if (body.key === 'payments' && Array.isArray(previous) && previous.some((row: any) => !value.some((item: any) => item.id === row.id && sameValue(item, row)))) return json({ error: 'Posted receipts cannot be changed or deleted.' }, 400)
    }
    if (body.key === 'leads' && Array.isArray(value)) {
      const workflows = await loadData('leadWorkflows') || {}
      for (const lead of value as any[]) {
        const before = previous?.find((row: any) => row.id === lead.id)
        if (before?.status === lead.status) continue
        const workflow = workflows[lead.workflowKey || lead.id] || {}
        if (!['New Leads', 'Contacted', 'Discovery', 'Proposal sent', 'Awaiting deposit', 'Won', 'Lost'].includes(lead.status)) return json({ error: 'Invalid lead stage.' }, 400)
        if (['Contacted', 'Discovery'].includes(lead.status) && !(lead.email?.trim() || lead.phone?.trim())) return json({ error: 'Add contact details before progressing this lead.' }, 400)
        if (lead.status === 'Proposal sent' && !workflow.proposals?.some((proposal: any) => ['Sent', 'Accepted'].includes(proposal.status))) return json({ error: 'Mark a proposal as sent first.' }, 400)
        if (lead.status === 'Lost' && !lead.lostReason?.trim()) return json({ error: 'Record a reason before marking a lead lost.' }, 400)
        if (lead.status === 'Awaiting deposit' && !workflow.acceptance) return json({ error: 'Record proposal acceptance first.' }, 400)
        if (lead.status === 'Won' && (!workflow.acceptance || !workflow.deposits?.some((item: any) => item.amount > 0))) return json({ error: 'An accepted proposal and recorded deposit are required to win an opportunity.' }, 400)
      }
    }
    if (body.key === 'projects' && Array.isArray(value)) {
      const workflows = await loadData('leadWorkflows') || {}
      for (const project of value as any[]) {
        if (!project.leadId || previous?.some((row: any) => row.id === project.id)) continue
        const workflow = workflows[project.workflowKey]
        if (!workflow?.acceptance || !workflow.deposits?.some((deposit: any) => deposit.amount > 0)) return json({ error: 'Accept a proposal and record its deposit before converting to a project.' }, 400)
        const acceptedProposal = workflow.proposals?.find((proposal: any) => proposal.id === workflow.acceptance.proposalId)
        if (acceptedProposal?.scope && project.scope !== acceptedProposal.scope) return json({ error: 'Project scope must match the accepted proposal.' }, 400)
      }
    }
    if (body.key === 'leadWorkflows' && value && typeof value === 'object') {
      const files = await loadData('workflowFiles') || {}
      for (const [workflowKey, workflow] of Object.entries(value) as [string, any][]) {
        if (!['owner', 'admin'].includes(account.role) && (!sameValue(workflow.acceptance, previous?.[workflowKey]?.acceptance) || !sameValue(workflow.deposits, previous?.[workflowKey]?.deposits))) return json({ error: 'Only admins can record acceptance and deposits.' }, 403)
        if (workflow.acceptance && !workflow.proposals?.some((proposal: any) => proposal.id === workflow.acceptance.proposalId && proposal.amount > 0)) return json({ error: 'Acceptance must reference a priced proposal.' }, 400)
        if (workflow.proposals?.some((proposal: any) => proposal.fileId && !files[proposal.fileId]) || workflow.acceptance?.fileId && !files[workflow.acceptance.fileId]) return json({ error: 'Attached proposal or approval file was not found.' }, 400)
        if (workflow.acceptance?.method === 'Signed file' && !workflow.acceptance.fileId && !sameValue(workflow.acceptance, previous?.[workflowKey]?.acceptance)) return json({ error: 'Attach the signed approval file.' }, 400)
        if (workflow.deposits?.length && (!workflow.acceptance || workflow.deposits.some((deposit: any) => !Number.isFinite(deposit.amount) || deposit.amount <= 0))) return json({ error: 'Deposits require proposal acceptance and positive amounts.' }, 400)
      }
    }
    const history = (rows[0]?.value as any)?.__crm === 1 ? (rows[0].value as any).history || [] : []
    const event = { id: crypto.randomUUID(), collection: body.key, actor: account.display_name || account.email, createdAt: new Date().toISOString(), action: previous == null ? 'Created' : 'Updated', entityIds: Array.isArray(value) ? value.filter((item: any) => !sameValue(item, previous?.find((old: any) => old.id === item.id))).map((item: any) => item.id) : Object.keys(value as object || {}), detail: `${body.key} saved` }
    if (Array.isArray(value)) {
      const changed = value.filter((item: any) => !sameValue(item, previous?.find((old: any) => old.id === item.id))) as any[]
      const removed = Array.isArray(previous) ? previous.filter((item: any) => !(value as any[]).some(row => row.id === item.id)) : []
      event.entityIds = [...new Set([...changed, ...removed].flatMap(item => [item.id, item.clientId, item.projectId, item.leadId, item.workflowKey].filter(Boolean)))]
      event.detail = [...changed.map(item => { const old = previous?.find((row: any) => row.id === item.id); return `${item.name || item.title || item.note || body.key}: ${old?.status && old.status !== item.status ? `${old.status} → ${item.status}` : old ? 'updated' : 'created'}` }), ...removed.map((item: any) => `${item.name || item.title || body.key}: removed`)].join('; ').slice(0, 1500)
    }
    const storedValue = { __crm: 1, data: value, history: ['leads', 'clients', 'projects', 'tasks', 'payments', 'paymentSchedules', 'leadWorkflows', 'interactions', 'contacts'].includes(body.key) ? [event, ...history].slice(0, 1000) : history }
    const saved = rows.length
      ? await db(`crm_collections?workspace_id=eq.${workspaceId}&collection_key=eq.${key}&updated_at=eq.${encodeURIComponent(rows[0].updated_at)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ value: storedValue }) }) as unknown[]
      : await db('crm_collections?on_conflict=workspace_id%2Ccollection_key', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ workspace_id: account.workspace_id, collection_key: body.key, value: storedValue }) }) as unknown[]
    if (!saved.length) return json({ error: 'Another save arrived at the same time. Retry to merge your changes.' }, 409)
    return json({ ok: true, value })
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'CRM data could not be saved.' }, 502)
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
    res.end(JSON.stringify({ error: 'The CRM data service could not complete the request.' }))
  }
}
