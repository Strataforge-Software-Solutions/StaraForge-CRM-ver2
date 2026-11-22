import { updateDatabaseCollection } from './database'

export type LeadActivityEntry = { id: string; action: string; detail: string; createdAt: string }
export type LeadActivityMap = Record<string, LeadActivityEntry[]>

export function leadActivityKey(name: string) {
  return name.trim().toLocaleLowerCase()
}

export async function recordLeadActivity(leadName: string, action: string, detail: string) {
  const key = leadActivityKey(leadName)
  if (!key) return
  const entry: LeadActivityEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, action, detail, createdAt: new Date().toISOString() }
  await updateDatabaseCollection<LeadActivityMap>('leadActivities', {}, current => ({ ...current, [key]: [entry, ...(current[key] ?? [])].slice(0, 50) }))
}

export async function moveLeadActivityHistory(fromName: string, toName: string) {
  const fromKey = leadActivityKey(fromName)
  const toKey = leadActivityKey(toName)
  if (!fromKey || !toKey || fromKey === toKey) return
  await updateDatabaseCollection<LeadActivityMap>('leadActivities', {}, current => {
    const existing = current[fromKey] ?? []
    if (!existing.length) return current
    const merged = [...existing, ...(current[toKey] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50)
    const next = { ...current, [toKey]: merged }
    delete next[fromKey]
    return next
  })
}
