// Utilities for loading, caching, and decompressing shards of product data

const shardCache: Record<number, Map<string, any>> = {};
const descCache: Record<number, Map<string, any>> = {};
const shardPending: Record<number, Promise<Map<string, any>> | undefined> = {};
const descPending: Record<number, Promise<Map<string, any>> | undefined> = {};
let shardMapCache: Record<string, number> | null = null;
let shardMapPending: Promise<Record<string, number>> | null = null;

const BASE_URL = import.meta.env.BASE_URL || '/';

export async function fetchGzipJSON(url: string): Promise<any> {
  const r = await fetch(url, { cache: 'force-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  
  const ct = r.headers.get('content-type') || '';
  const ce = r.headers.get('content-encoding') || '';
  
  // If the server already sets Content-Encoding: gzip, the browser decompresses it automatically
  if (ce.toLowerCase().includes('gzip')) {
    return r.json();
  }
  
  // Otherwise, if it is a gzipped file, we decompress it manually in the browser
  if (
    ct.toLowerCase().includes('gzip') ||
    ct.toLowerCase().includes('octet-stream') ||
    url.endsWith('.gz')
  ) {
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const decompressed = r.body?.pipeThrough(ds);
      if (decompressed) {
        const text = await new Response(decompressed).text();
        return JSON.parse(text);
      }
    }
  }
  return r.json();
}

export async function loadShardMap(): Promise<Record<string, number>> {
  if (shardMapCache) return shardMapCache;
  if (shardMapPending) return shardMapPending;

  shardMapPending = (async () => {
    try {
      const url = `${BASE_URL}data/shard-map.json`;
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error('Failed to load shard-map.json: HTTP ' + res.status);
      shardMapCache = await res.json();
      return shardMapCache || {};
    } catch (e) {
      console.warn('Shard map unavailable:', e);
      shardMapCache = {};
      return {};
    } finally {
      shardMapPending = null;
    }
  })();

  return shardMapPending;
}

export async function loadShard(num: number): Promise<Map<string, any>> {
  if (shardCache[num]) return shardCache[num];
  if (shardPending[num]) return shardPending[num];

  const shardStr = String(num).padStart(4, '0');
  const url = `${BASE_URL}data/shards/p-${shardStr}.json.gz`;

  shardPending[num] = (async () => {
    try {
      const arr = await fetchGzipJSON(url);
      const map = new Map<string, any>();
      if (Array.isArray(arr)) {
        arr.forEach((it: any) => {
          map.set(String(it.id), it);
          if (typeof it.id !== 'string') map.set(it.id, it);
        });
      }
      shardCache[num] = map;
      return map;
    } catch (e: any) {
      console.warn('Shard ' + num + ' is unavailable:', e.message);
      const empty = new Map<string, any>();
      shardCache[num] = empty;
      return empty;
    } finally {
      delete shardPending[num];
    }
  })();

  return shardPending[num];
}

export async function loadDescShard(num: number): Promise<Map<string, any>> {
  if (descCache[num]) return descCache[num];
  if (descPending[num]) return descPending[num];

  const shardStr = String(num).padStart(4, '0');
  const url = `${BASE_URL}data/desc/d-${shardStr}.json.gz`;

  descPending[num] = (async () => {
    try {
      const arr = await fetchGzipJSON(url);
      const map = new Map<string, any>();
      if (Array.isArray(arr)) {
        arr.forEach((it: any) => {
          map.set(String(it.id), it);
          if (typeof it.id !== 'string') map.set(it.id, it);
        });
      }
      descCache[num] = map;
      return map;
    } catch (e: any) {
      console.warn('Description shard ' + num + ' is unavailable:', e.message);
      const empty = new Map<string, any>();
      descCache[num] = empty;
      return empty;
    } finally {
      delete descPending[num];
    }
  })();

  return descPending[num];
}

export function mapGet(map: Map<string, any> | undefined, id: string): any {
  if (!map) return undefined;
  let v = map.get(id);
  if (v !== undefined) return v;
  v = map.get(String(id));
  if (v !== undefined) return v;
  const num = Number(id);
  if (!Number.isNaN(num)) {
    v = map.get(num as any);
    if (v !== undefined) return v;
  }
  return undefined;
}
