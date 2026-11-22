export { recordId } from '../../shared/crm'
export type { RecordIdentity } from '../../shared/crm'
import type { RecordIdentity } from '../../shared/crm'
export function overrideFor<T>(map: Record<string, T>, row: RecordIdentity & { name: string }): T | undefined { return map[row.id || ''] ?? map[row.legacyName || row.name] ?? map[row.name] }
export function related(row: RecordIdentity & { client?: string; project?: string }, parent: RecordIdentity & { name: string }, field: 'client' | 'project') {
  const id = field === 'client' ? row.clientId : row.projectId
  return id && parent.id ? id === parent.id : row[field] === parent.name || row[field] === parent.legacyName
}
