import crypto from 'crypto';
import Redis from 'ioredis';

export interface BffSessionRecord {
  accessToken: string;
  organizationId?: string;
  userId?: string;
  expiresAt: number;
  createdAt: number;
}

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

declare global {
  // eslint-disable-next-line no-var
  var __jesmondBffSessionStore: Map<string, BffSessionRecord> | undefined;
  // eslint-disable-next-line no-var
  var __jesmondBffRedisClient: Redis | undefined;
  // eslint-disable-next-line no-var
  var __jesmondPendingRevokedHandles: Set<string> | undefined;
}

function getPendingRevokedHandles(): Set<string> {
  if (!globalThis.__jesmondPendingRevokedHandles) {
    globalThis.__jesmondPendingRevokedHandles = new Set<string>();
  }
  return globalThis.__jesmondPendingRevokedHandles;
}

export function markHandlePendingRevocation(handle: string): void {
  if (!handle) return;
  const set = getPendingRevokedHandles();
  // Cap in-memory tombstone set size to prevent unbounded growth during prolonged outages
  if (set.size >= 10_000) {
    const oldest = set.values().next().value;
    if (oldest) set.delete(oldest);
  }
  set.add(handle);
}

function getMemoryStore(): Map<string, BffSessionRecord> {
  if (!globalThis.__jesmondBffSessionStore) {
    globalThis.__jesmondBffSessionStore = new Map<string, BffSessionRecord>();
  }
  return globalThis.__jesmondBffSessionStore;
}

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (isProductionEnv()) {
      throw new Error('REDIS_URL is required in production for shared SSO session storage');
    }
    return null;
  }

  if (!globalThis.__jesmondBffRedisClient) {
    const isTls = redisUrl.startsWith('rediss://');
    const client = new Redis(redisUrl, {
      connectTimeout: 5000,
      commandTimeout: 3000,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      ...(isTls ? { tls: { rejectUnauthorized: true } } : {}),
    });

    client.on('error', (err) => {
      console.error('[BffSessionStore] Redis connection error:', err?.message || 'Unknown error');
    });

    client.on('ready', () => {
      const pending = getPendingRevokedHandles();
      if (pending.size === 0) return;
      for (const h of Array.from(pending)) {
        void client
          .del(redisKey(h))
          .then(() => {
            pending.delete(h);
          })
          .catch(() => {
            // Retain in pending set until a future Redis command succeeds
          });
      }
    });

    globalThis.__jesmondBffRedisClient = client;
  }

  return globalThis.__jesmondBffRedisClient;
}

export function generateOpaqueSessionHandle(): string {
  return crypto.randomBytes(32).toString('base64url');
}

const redisKey = (handle: string) => `bff:sso:session:${handle}`;

export async function saveBffSession(
  handle: string,
  record: BffSessionRecord,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    await redis.set(
      redisKey(handle),
      JSON.stringify(record),
      'EX',
      ttlSeconds,
    );
    return;
  }

  const store = getMemoryStore();
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now) {
      store.delete(k);
    }
  }
  store.set(handle, record);
}

export async function getBffSession(
  handle: string,
): Promise<BffSessionRecord | null> {
  if (!handle) return null;

  const pending = getPendingRevokedHandles();
  if (pending.has(handle)) {
    const redis = getRedisClient();
    if (redis) {
      await redis.del(redisKey(handle));
      pending.delete(handle);
    } else {
      getMemoryStore().delete(handle);
      pending.delete(handle);
    }
    return null;
  }

  const redis = getRedisClient();
  if (redis) {
    const raw = await redis.get(redisKey(handle));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as BffSessionRecord;
      if (!parsed.accessToken || parsed.expiresAt <= Date.now()) {
        await deleteBffSession(handle);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  const store = getMemoryStore();
  const record = store.get(handle);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    store.delete(handle);
    return null;
  }
  return record;
}

export async function deleteBffSession(handle: string): Promise<void> {
  if (!handle) return;
  const redis = getRedisClient();
  if (redis) {
    await redis.del(redisKey(handle));
    return;
  }
  getMemoryStore().delete(handle);
}

export async function rotateBffSession(
  oldHandle: string,
  updates?: Partial<BffSessionRecord>,
): Promise<{ newHandle: string; record: BffSessionRecord } | null> {
  if (!oldHandle) return null;

  let existing: BffSessionRecord | null = null;
  const redis = getRedisClient();
  if (redis) {
    // Atomically consume the old session handle so concurrent refresh requests cannot reuse it
    const raw = await redis.getdel(redisKey(oldHandle));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as BffSessionRecord;
      if (!parsed.accessToken || parsed.expiresAt <= Date.now()) {
        return null;
      }
      existing = parsed;
    } catch {
      return null;
    }
  } else {
    const store = getMemoryStore();
    const record = store.get(oldHandle);
    store.delete(oldHandle);
    if (!record || record.expiresAt <= Date.now()) {
      return null;
    }
    existing = record;
  }

  const newHandle = generateOpaqueSessionHandle();
  const now = Date.now();
  const newRecord: BffSessionRecord = {
    ...existing,
    ...updates,
    expiresAt: now + DEFAULT_TTL_SECONDS * 1000,
  };

  await saveBffSession(newHandle, newRecord, DEFAULT_TTL_SECONDS);
  return { newHandle, record: newRecord };
}
