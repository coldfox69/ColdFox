/**
 * Server-side cache with two layers:
 *
 *  1. An in-process LRU for hot, cheap-to-serve values (per instance).
 *  2. A shared Postgres-backed store (`cache_entries`) so every app instance
 *     sees the same entry. This is the Redis-equivalent layer: it works on the
 *     existing Supabase connection with no extra service to provision.
 *
 * Both layers are optional. If the shared table is missing the helper
 * degrades to the in-process layer instead of failing the request.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

const DEFAULT_TTL_SECONDS = 60;
const MAX_LOCAL_ENTRIES = 500;

type Entry = { value: unknown; expiresAt: number };

const local = new Map<string, Entry>();

function readLocal(key: string): unknown | undefined {
  const hit = local.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    local.delete(key);
    return undefined;
  }
  // Refresh LRU position.
  local.delete(key);
  local.set(key, hit);
  return hit.value;
}

function writeLocal(key: string, value: unknown, ttlSeconds: number) {
  if (local.size >= MAX_LOCAL_ENTRIES) {
    const oldest = local.keys().next().value;
    if (oldest !== undefined) local.delete(oldest);
  }
  local.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** Shared cache read. Returns undefined when the store is unavailable. */
async function readShared(key: string): Promise<unknown | undefined> {
  try {
    const { data, error } = await createServiceClient()
      .from('cache_entries')
      .select('value, expires_at')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return undefined;
    const expiresAt = new Date(data.expires_at as string).getTime();
    if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) return undefined;
    return data.value as unknown;
  } catch {
    return undefined;
  }
}

async function writeShared(key: string, value: unknown, ttlSeconds: number) {
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await createServiceClient()
      .from('cache_entries')
      .upsert({ key, value: value as never, expires_at: expiresAt }, { onConflict: 'key' });
  } catch {
    // Cache writes must never break the request path.
  }
}

/**
 * Read a cached value. `undefined` means "not cached".
 */
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const localHit = readLocal(key);
  if (localHit !== undefined) return localHit as T;

  const shared = await readShared(key);
  if (shared !== undefined) {
    writeLocal(key, shared, DEFAULT_TTL_SECONDS);
    return shared as T;
  }
  return undefined;
}

/**
 * Read a cached value, computing and storing it on a miss.
 * Concurrent misses for the same key share one computation (request dedupe).
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cacheRemember<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const value = await compute();
      writeLocal(key, value, ttlSeconds);
      await writeShared(key, value, ttlSeconds);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise as Promise<T>;
}

/** Write a value into both cache layers. */
export async function cacheSet(key: string, value: unknown, ttlSeconds = DEFAULT_TTL_SECONDS) {
  writeLocal(key, value, ttlSeconds);
  await writeShared(key, value, ttlSeconds);
}

/** Drop one key (or every key with a prefix) from both layers. */
export async function cacheInvalidate(prefix?: string) {
  if (!prefix) {
    local.clear();
  } else {
    for (const key of local.keys()) {
      if (key.startsWith(prefix)) local.delete(key);
    }
  }
  try {
    const query = createServiceClient().from('cache_entries').delete();
    const { error } = prefix
      ? await query.like('key', `${prefix}%`)
      : await query.not('key', 'is', null);
    if (error) console.warn('[cache] invalidation failed', error.message);
  } catch {
    // ignore
  }
}

/** Build a stable cache key from parts. */
export function cacheKey(...parts: (string | number | undefined | null)[]) {
  return parts.filter((p) => p !== undefined && p !== null).join(':');
}
