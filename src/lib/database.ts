import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getCurrentSession, readCollection, writeCollection, type SupabaseSession } from './supabase'

type CacheEntry = { value: unknown; version: number; loaded: boolean; listeners: Set<() => void> }
const cache = new Map<string, CacheEntry>()
const writeQueues = new Map<string, Promise<void>>()
const mutationQueues = new Map<string, Promise<void>>()
type DbStatus = 'connecting' | 'connected' | 'error'
let status: DbStatus = 'connecting'
let errorMessage = ''
let currentWorkspaceId: string | null = null
const statusListeners = new Set<() => void>()

function setStatus(next: DbStatus, message = '') {
  status = next
  errorMessage = message
  statusListeners.forEach(listener => listener())
}

export function configureDatabaseWorkspace(workspaceId: string | null) {
  if (currentWorkspaceId === workspaceId) return
  currentWorkspaceId = workspaceId
  cache.clear()
  writeQueues.clear()
  mutationQueues.clear()
  setStatus(workspaceId ? 'connecting' : 'error', workspaceId ? '' : 'Sign in to connect to the workspace database.')
}

export function getCurrentDatabaseWorkspaceId() {
  return currentWorkspaceId
}

export function useDatabaseStatus() {
  const current = useSyncExternalStore(listener => { statusListeners.add(listener); return () => statusListeners.delete(listener) }, () => status, () => 'connecting')
  return { status: current, error: errorMessage }
}

function entryFor<T>(key: string, initial: T): CacheEntry {
  let entry = cache.get(key)
  if (!entry) {
    entry = { value: initial, version: 0, loaded: false, listeners: new Set() }
    cache.set(key, entry)
  }
  return entry
}

async function readFromSupabase<T>(key: string): Promise<{ session: SupabaseSession; value: T | null; workspaceId: string }> {
  if (!currentWorkspaceId) throw new Error('This account is not connected to a workspace.')
  const session = await getCurrentSession()
  if (!session) throw new Error('Your sign-in session expired. Sign in again.')
  const value = await readCollection<T>(session, currentWorkspaceId, key)
  return { session, value, workspaceId: currentWorkspaceId }
}

async function writeToSupabase<T>(key: string, value: T, session?: SupabaseSession, workspaceId = currentWorkspaceId) {
  if (!workspaceId) throw new Error('This account is not connected to a workspace.')
  const activeSession = session ?? await getCurrentSession()
  if (!activeSession) throw new Error('Your sign-in session expired. Sign in again.')
  const previous = writeQueues.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(() => writeCollection(activeSession, workspaceId, key, value))
  writeQueues.set(key, next)
  try {
    await next
    setStatus('connected')
  } finally {
    if (writeQueues.get(key) === next) writeQueues.delete(key)
  }
}

export function useDatabaseCollection<T>(key: string, initial: T): [T, (next: T | ((current: T) => T)) => void] {
  const entry = entryFor(key, initial)
  const [value, setValue] = useState(entry.value as T)

  useEffect(() => {
    const notify = () => setValue(entry.value as T)
    entry.listeners.add(notify)
    if (!entry.loaded) {
      const versionAtStart = entry.version
      void readFromSupabase<T>(key).then(async ({ session, value: stored, workspaceId }) => {
        if (currentWorkspaceId !== workspaceId) return
        if (entry.version === versionAtStart) {
          entry.value = stored ?? initial
          entry.version++
          entry.loaded = true
          entry.listeners.forEach(listener => listener())
          if (stored === null) await writeToSupabase(key, entry.value, session, workspaceId)
          else setStatus('connected')
        } else {
          entry.loaded = true
          await writeToSupabase(key, entry.value, session, workspaceId)
        }
      }).catch(error => {
        entry.loaded = true
        setStatus('error', error instanceof Error ? error.message : 'Supabase database connection failed.')
        entry.listeners.forEach(listener => listener())
      })
    }
    return () => { entry.listeners.delete(notify) }
  }, [entry, initial, key])

  const update = useCallback((next: T | ((current: T) => T)) => {
    const resolved = typeof next === 'function' ? (next as (current: T) => T)(entry.value as T) : next
    entry.value = resolved
    entry.version++
    setValue(resolved)
    entry.listeners.forEach(listener => listener())
    if (entry.loaded) void writeToSupabase(key, resolved).catch(error => setStatus('error', error instanceof Error ? error.message : 'Supabase database save failed.'))
  }, [entry, key])
  return [value, update]
}

export async function updateDatabaseCollection<T>(key: string, initial: T, update: (current: T) => T): Promise<void> {
  const previous = mutationQueues.get(key) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(async () => {
    const entry = entryFor(key, initial)
    if (!entry.loaded) {
      const loaded = await readFromSupabase<T>(key)
      if (currentWorkspaceId !== loaded.workspaceId) return
      entry.value = loaded.value ?? initial
      entry.loaded = true
    }
    entry.value = update(entry.value as T)
    entry.version++
    entry.listeners.forEach(listener => listener())
    await writeToSupabase(key, entry.value)
  })
  mutationQueues.set(key, next)
  try { await next } finally { if (mutationQueues.get(key) === next) mutationQueues.delete(key) }
}
