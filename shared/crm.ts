export type RecordIdentity = { id?: string; legacyName?: string; workflowKey?: string; createdAt?: string; updatedAt?: string; clientId?: string; projectId?: string; leadId?: string }
export function recordId(row: { id?: string; name?: string; title?: string }) { return row.id || row.name || row.title || '' }
function hash(value: string) { let result = 2166136261; for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619); return (result >>> 0).toString(36) }
export function normalizeCollection(key: string, value: any): any {
  if (!['leads', 'clients', 'projects', 'tasks'].includes(key) || !Array.isArray(value)) return value
  return value.map((row, index) => ({ ...row, id: row.id || `legacy-${key}-${hash(JSON.stringify([row.name || row.title, row.email, row.client || row.project, index]))}`, legacyName: row.legacyName || row.name || row.title,
    ...(key === 'leads' ? { workflowKey: row.workflowKey || row.email?.trim().toLowerCase() || `${row.name?.trim().toLowerCase()}::${row.client?.trim().toLowerCase()}` } : {}) }))
}
export function sameValue(a: any, b: any): boolean {
  if (Object.is(a, b)) return true
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => sameValue(value, b[index]))
  const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && sameValue(a[key], b[key]))
}
const equal = sameValue
// Three-way merge: independent edits merge; overlapping edits require review.
export function mergeChanges(base: any, desired: any, current: any, path = 'record'): any {
  if (equal(base, desired)) return current
  if (path.endsWith('/updatedAt') && typeof desired === 'string' && typeof current === 'string') return desired > current ? desired : current
  if (path.endsWith('/createdAt') && typeof desired === 'string' && typeof current === 'string') return desired < current ? desired : current
  if (equal(base, current) || equal(desired, current)) return desired
  if ([base, desired, current].every(Array.isArray) && [...base, ...desired, ...current].every(row => row && typeof row === 'object' && row.id != null)) {
    const before = new Map(base.map((row: any) => [String(row.id), row]))
    const after = new Map(desired.map((row: any) => [String(row.id), row]))
    const latest = new Map(current.map((row: any) => [String(row.id), row]))
    const ids = [...new Set([...latest.keys(), ...after.keys()])]
    return ids.map(id => mergeChanges(before.get(id), after.get(id), latest.get(id), `${path}/${id}`)).filter(row => row !== undefined)
  }
  if ([base, desired, current].every(value => value && typeof value === 'object' && !Array.isArray(value))) {
    const result: Record<string, unknown> = {}
    for (const key of new Set([...Object.keys(base), ...Object.keys(desired), ...Object.keys(current)])) {
      const value = mergeChanges(base[key], desired[key], current[key], `${path}/${key}`)
      if (value !== undefined) result[key] = value
    }
    return result
  }
  throw new Error(`Another user changed ${path}. Your draft is preserved. Reload the latest data and review your changes.`)
}
