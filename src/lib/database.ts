import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getCurrentSession, readCollection, writeCollection } from './workspaceAccount'
import { mergeChanges, normalizeCollection } from '../../shared/crm'

type Entry = { value: any; base: any; loaded: boolean; loading?: Promise<void>; saving?: Promise<void>; dirty: boolean; error: string; listeners: Set<() => void> }
const cache = new Map<string, Entry>()
let workspace: string | null = null
let lastSynced = ''
let statusVersion = 0
const listeners = new Set<() => void>()
const pending = new Set<Promise<unknown>>()
function announce(entry?: Entry) { entry?.listeners.forEach(listener => listener()); statusVersion++; listeners.forEach(listener => listener()) }
function entryFor(key: string, initial: unknown): Entry {
  let entry = cache.get(key)
  if (!entry) { entry = { value: initial, base: null, loaded: false, dirty: false, error: '', listeners: new Set() }; cache.set(key, entry) }
  return entry
}
export function configureDatabaseWorkspace(id: string | null) { if (id !== workspace) { workspace = id; cache.clear(); lastSynced = ''; announce() } }
export function getCurrentDatabaseWorkspaceId() { return workspace }
async function load(key: string, entry: Entry, refresh = false) {
  if (entry.loading) return entry.loading
  if (entry.loaded && !refresh) return
  const scope = workspace
  entry.loading = (async () => {
    if (!scope) throw new Error('Sign in to connect to your workspace.')
    const session = await getCurrentSession()
    if (!session) throw new Error('Sign in again to continue.')
    const stored = await readCollection(session, scope, key)
    if (workspace !== scope || entry.dirty) return
    entry.base = stored
    entry.value = normalizeCollection(key, stored ?? entry.value)
    entry.loaded = true; entry.error = ''; lastSynced = new Date().toISOString()
  })().catch(error => { entry.error = error.message; throw error }).finally(() => { entry.loading = undefined; announce(entry) })
  return entry.loading
}
async function save(key: string, entry: Entry): Promise<void> {
  if (entry.saving) return entry.saving
  const scope = workspace
  entry.saving = (async () => {
    if (!scope) throw new Error('Sign in to save your changes.')
    const session = await getCurrentSession()
    if (!session) throw new Error('Sign in again to save your changes.')
    while (entry.dirty) {
      if (scope !== workspace) throw new Error('Workspace changed. Save cancelled.')
      const desired = entry.value
      const result = await writeCollection(session, scope, key, desired, entry.base)
      if (scope !== workspace) return
      entry.base = result.value
      entry.value = mergeChanges(desired, entry.value, result.value)
      entry.dirty = JSON.stringify(entry.value) !== JSON.stringify(result.value)
      entry.error = ''; lastSynced = new Date().toISOString(); announce(entry)
    }
  })().catch(error => { entry.error = error.message; throw error }).finally(() => { entry.saving = undefined; announce(entry) })
  announce()
  return entry.saving
}
function track<T>(promise: Promise<T>) { pending.add(promise); void promise.finally(() => pending.delete(promise)).catch(() => undefined); return promise }
function prepare(key: string, value: any, before: any) {
  const normalized = normalizeCollection(key, value)
  if (!['leads', 'clients', 'projects', 'tasks'].includes(key) || !Array.isArray(normalized)) return normalized
  const now = new Date().toISOString()
  return normalized.map(row => {
    const old = Array.isArray(before) ? before.find(item => item.id === row.id) : undefined
    return JSON.stringify(old) === JSON.stringify(row) ? row : { ...row, createdAt: row.createdAt || now, updatedAt: now, ...(key === 'leads' && old?.status !== row.status ? { stageEnteredAt: now } : {}) }
  })
}
export async function updateDatabaseCollection<T>(key: string, initial: T, update: (current: T) => T): Promise<void> {
  const entry = entryFor(key, initial)
  return track((async () => {
    await load(key, entry)
    entry.value = prepare(key, update(entry.value), entry.value); entry.dirty = true; entry.error = ''; announce(entry)
    await save(key, entry)
  })())
}
export function useDatabaseCollection<T>(key: string, initial: T): [T, (next: T | ((current: T) => T)) => void] {
  const entry = entryFor(key, initial)
  const [, render] = useState(0)
  useEffect(() => {
    const notify = () => render(value => value + 1)
    entry.listeners.add(notify)
    void load(key, entry).catch(() => undefined)
    const refresh = () => { if (!entry.dirty && document.visibilityState === 'visible') void load(key, entry, true).catch(() => undefined) }
    const interval = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { entry.listeners.delete(notify); clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [entry, key])
  const update = useCallback((next: T | ((current: T) => T)) => {
    void updateDatabaseCollection<T>(key, initial, current => typeof next === 'function' ? (next as (value: T) => T)(current) : next).catch(() => undefined)
  }, [key, entry])
  return [entry.value as T, update]
}
export async function flushDatabaseWrites() {
  while (pending.size) await Promise.all([...pending])
  const failed = [...cache.values()].find(entry => entry.error && entry.dirty)
  if (failed) throw new Error(failed.error)
}
export async function retryDatabaseWrites() {
  await Promise.all([...cache].map(([key, entry]) => entry.dirty ? save(key, entry) : entry.error ? load(key, entry, true) : Promise.resolve()))
}
export async function reloadSavedData() {
  await Promise.all([...cache].map(async ([key, entry]) => { if (entry.saving) await entry.saving.catch(() => undefined); entry.dirty = false; await load(key, entry, true) }))
}
export function downloadUnsavedDrafts() {
  const draft = Object.fromEntries([...cache].filter(([, entry]) => entry.dirty).map(([key, entry]) => [key, entry.value]))
  const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = 'crm-unsaved-drafts.json'; link.click(); URL.revokeObjectURL(url)
}
export function useDatabaseStatus() {
  useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => statusVersion)
  const entries = [...cache.values()]
  const failed = entries.find(entry => entry.error)
  return { status: failed ? 'error' : entries.some(entry => entry.dirty || entry.saving) ? 'saving' : entries.some(entry => !entry.loaded) ? 'connecting' : 'connected', error: failed?.error || '', lastSynced }
}
if (typeof window !== 'undefined') window.addEventListener('beforeunload', event => { if ([...cache.values()].some(entry => entry.dirty)) { event.preventDefault(); event.returnValue = '' } })
