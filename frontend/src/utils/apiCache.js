/**
 * Lightweight stale-while-revalidate API cache.
 *
 * How it works:
 *  - First call for a URL: fetches normally, stores result + timestamp.
 *  - Subsequent calls within STALE_MS: returns cached response immediately (no network round-trip).
 *  - Calls after STALE_MS: fetches fresh data and updates the cache.
 *
 * Result: navigating back to Dashboard or Problems shows data instantly instead of
 * waiting for the network on every visit.
 */

import axios from 'axios';

const _cache = new Map();
const STALE_MS = 25_000; // 25 seconds — fresh enough, instant on second visit

/**
 * GET with caching. Drop-in replacement for axios.get().
 * @param {string} url
 * @param {object} config  Same options as axios.get (withCredentials, headers, etc.)
 * @returns {Promise<AxiosResponse>}
 */
export async function cachedGet(url, config = {}) {
  const hit = _cache.get(url);
  const now = Date.now();

  if (hit && now - hit.ts < STALE_MS) {
    return hit.res;          // cache hit — zero network latency
  }

  const res = await axios.get(url, config);
  _cache.set(url, { res, ts: now });
  return res;
}

/**
 * Stale-while-revalidate: return cached data immediately AND kick off a
 * background refresh, calling onUpdate(freshRes) when it arrives.
 *
 * Use this when you want the UI to paint instantly with old data, then silently
 * update once fresh data comes back from the server.
 *
 * @param {string}   url
 * @param {object}   config
 * @param {function} onUpdate  Called with the fresh response after background fetch
 * @returns {AxiosResponse|null}  Cached response (or null if nothing cached yet)
 */
export function swrGet(url, config = {}, onUpdate) {
  const hit = _cache.get(url);
  const now = Date.now();

  if (hit) {
    // Return cached immediately
    const stale = now - hit.ts > STALE_MS;
    if (stale && onUpdate) {
      // Revalidate in background
      axios.get(url, config).then(res => {
        _cache.set(url, { res, ts: Date.now() });
        onUpdate(res);
      }).catch(() => {});
    }
    return hit.res;
  }
  return null; // nothing cached — caller should do a normal fetch
}

/** Remove a specific URL from the cache (e.g. after a mutation). */
export function invalidate(url) {
  _cache.delete(url);
}

/** Remove all URLs that start with a given prefix. */
export function invalidatePrefix(prefix) {
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

/** Wipe the entire cache (e.g. on logout). */
export function clearCache() {
  _cache.clear();
}
