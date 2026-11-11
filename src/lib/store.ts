// Browser-only persistence.
//
// Everything lives in IndexedDB (falling back to localStorage, then memory).
// All keys are loaded into an in-memory cache at startup so reads are synchronous,
// and writes go through the cache first and are flushed to disk shortly after.

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { uid } from './util'

const DB_NAME = 'creator-toolkit'
const KV = 'kv'
const BLOBS = 'blobs'
const LS_PREFIX = 'ct:'

let db: IDBDatabase | null = null
const cache = new Map<string, unknown>()
/** Keys that hold real user data, as opposed to defaults read into the cache. */
const saved = new Set<string>()
const listeners = new Map<string, Set<() => void>>()
const timers = new Map<string, number>()
const memBlobs = new Map<string, Blob>()

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('IndexedDB timed out')), 4000)
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(KV)) d.createObjectStore(KV)
      if (!d.objectStoreNames.contains(BLOBS)) d.createObjectStore(BLOBS)
    }
    req.onsuccess = () => {
      window.clearTimeout(timeout)
      resolve(req.result)
    }
    req.onerror = () => {
      window.clearTimeout(timeout)
      reject(req.error ?? new Error('IndexedDB failed'))
    }
  })
}

function request<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('No database'))
    try {
      const req = run(db.transaction(store, mode).objectStore(store))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('Request failed'))
    } catch (err) {
      reject(err)
    }
  })
}

function persist(key: string): void {
  const value = cache.get(key)
  if (db) {
    request(KV, 'readwrite', (s) => s.put(value, key)).catch(() => {})
    return
  }
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable: keep working from memory */
  }
}

function flush(): void {
  for (const [key, timer] of timers) {
    window.clearTimeout(timer)
    persist(key)
  }
  timers.clear()
}

function emit(key: string): void {
  listeners.get(key)?.forEach((l) => l())
}

function emitAll(): void {
  listeners.forEach((set) => set.forEach((l) => l()))
}

export async function initStore(): Promise<void> {
  try {
    db = await openDB()
    const [keys, values] = await Promise.all([
      request(KV, 'readonly', (s) => s.getAllKeys()),
      request(KV, 'readonly', (s) => s.getAll() as IDBRequest<unknown[]>),
    ])
    keys.forEach((k, i) => {
      cache.set(String(k), values[i])
      saved.add(String(k))
    })
  } catch {
    db = null
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const raw = localStorage.key(i)
        if (!raw?.startsWith(LS_PREFIX)) continue
        const key = raw.slice(LS_PREFIX.length)
        cache.set(key, JSON.parse(localStorage.getItem(raw) ?? 'null'))
        saved.add(key)
      }
    } catch {
      /* memory only */
    }
  }
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

/** Which storage backend is in use, for the backup screen. */
export const storageKind = (): 'indexeddb' | 'localstorage' => (db ? 'indexeddb' : 'localstorage')

export function read<T>(key: string, fallback: T): T {
  if (!cache.has(key)) cache.set(key, fallback)
  return cache.get(key) as T
}

export function write<T>(key: string, next: T | ((prev: T) => T), fallback: T): void {
  const prev = read(key, fallback)
  const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
  if (Object.is(value, prev)) return
  cache.set(key, value)
  saved.add(key)
  window.clearTimeout(timers.get(key))
  timers.set(
    key,
    window.setTimeout(() => {
      timers.delete(key)
      persist(key)
    }, 250),
  )
  emit(key)
}

export type Setter<T> = (next: T | ((prev: T) => T)) => void

/** A persisted value. `fallback` must be a stable reference (a module constant). */
export function useStored<T>(key: string, fallback: T): readonly [T, Setter<T>] {
  const subscribe = useCallback(
    (listener: () => void) => {
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      const bucket = set
      bucket.add(listener)
      return () => {
        bucket.delete(listener)
      }
    },
    [key],
  )
  const value = useSyncExternalStore(subscribe, () => read(key, fallback))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const set = useCallback<Setter<T>>((next) => write(key, next, fallback), [key])
  return [value, set] as const
}

const EMPTY_LIST: never[] = []
const EMPTY_MAP = {}

/** A persisted list of records with ids. */
export function useCollection<T extends { id: string }>(key: string) {
  const [items, setItems] = useStored<T[]>(key, EMPTY_LIST as unknown as T[])
  const ops = useMemo(
    () => ({
      add(item: Omit<T, 'id'> & { id?: string }): T {
        const full = { ...item, id: item.id ?? uid() } as unknown as T
        setItems((prev) => [...prev, full])
        return full
      },
      update(id: string, patch: Partial<T>): void {
        setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
      },
      remove(id: string): void {
        setItems((prev) => prev.filter((x) => x.id !== id))
      },
      set: setItems,
    }),
    [setItems],
  )
  return useMemo(() => ({ items, ...ops }), [items, ops])
}

/** One document per parent id (for example one script per video). */
export function useDoc<T>(key: string, id: string | undefined, fallback: T): readonly [T, Setter<T>] {
  const [map, setMap] = useStored<Record<string, T>>(key, EMPTY_MAP as Record<string, T>)
  const value = id !== undefined && map[id] !== undefined ? map[id] : fallback
  const set = useCallback<Setter<T>>(
    (next) => {
      if (id === undefined) return
      setMap((prev) => {
        const current = prev[id] !== undefined ? prev[id] : fallback
        const value = typeof next === 'function' ? (next as (p: T) => T)(current) : next
        return Object.is(value, prev[id]) ? prev : { ...prev, [id]: value }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, setMap],
  )
  return [value, set] as const
}

// ---- backup / restore ----

export function exportData(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of [...saved].sort()) out[key] = cache.get(key)
  return out
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const hasId = (x: unknown): x is { id: string } => isObject(x) && typeof x.id === 'string'

function mergeLists(current: unknown[], incoming: unknown[]): unknown[] {
  if (![...current, ...incoming].every(hasId)) return [...new Set([...current, ...incoming])]
  const byId = new Map<string, unknown>()
  for (const item of current as { id: string }[]) byId.set(item.id, item)
  for (const item of incoming as { id: string }[]) byId.set(item.id, item)
  return [...byId.values()]
}

export async function importData(data: Record<string, unknown>, mode: 'merge' | 'replace'): Promise<void> {
  if (mode === 'replace') await wipe()
  for (const [key, incoming] of Object.entries(data)) {
    const current = cache.get(key)
    let value = incoming
    if (mode === 'merge' && saved.has(key)) {
      if (Array.isArray(current) && Array.isArray(incoming)) value = mergeLists(current, incoming)
      else if (isObject(current) && isObject(incoming)) value = { ...current, ...incoming }
    }
    cache.set(key, value)
    saved.add(key)
    persist(key)
  }
  emitAll()
}

export async function wipe(): Promise<void> {
  timers.forEach((t) => window.clearTimeout(t))
  timers.clear()
  cache.clear()
  saved.clear()
  memBlobs.clear()
  if (db) {
    await request(KV, 'readwrite', (s) => s.clear()).catch(() => {})
    await request(BLOBS, 'readwrite', (s) => s.clear()).catch(() => {})
  } else {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(LS_PREFIX))
        .forEach((k) => localStorage.removeItem(k))
    } catch {
      /* ignore */
    }
  }
  emitAll()
}

// ---- binary files (audio takes) ----

export async function putBlob(id: string, blob: Blob): Promise<void> {
  if (db) {
    try {
      await request(BLOBS, 'readwrite', (s) => s.put(blob, id))
      return
    } catch {
      /* fall through to memory */
    }
  }
  memBlobs.set(id, blob)
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const inMemory = memBlobs.get(id)
  if (inMemory) return inMemory
  if (!db) return undefined
  try {
    return (await request(BLOBS, 'readonly', (s) => s.get(id))) as Blob | undefined
  } catch {
    return undefined
  }
}

export async function deleteBlob(id: string): Promise<void> {
  memBlobs.delete(id)
  if (db) await request(BLOBS, 'readwrite', (s) => s.delete(id)).catch(() => {})
}
