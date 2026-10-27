import { isIP } from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import { transaction } from './database.ts';
import { ApiError, hash } from './service.ts';

type RateLimitRequest = readonly [key: string, maximum: number];
type RateLimiter = ((key: string, maximum: number, now?: number) => void) & {
  many: (requests: readonly RateLimitRequest[], now?: number) => void;
};

export function clientAddress(peer: string, forwarded: string | undefined, trusted: string[]) {
  const normalize = (value: string) => value.replace(/^::ffff:/, '');

  if (!trusted.map(normalize).includes(normalize(peer))) {
    return normalize(peer);
  }

  // The nearest trusted proxy must overwrite or append the actual connecting address.
  const address = forwarded?.split(',').at(-1)?.trim();

  return address && isIP(address) ? normalize(address) : normalize(peer);
}

export function createRateLimiter(db: DatabaseSync, capacity = 10000) {
  db.exec(`CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL
  ); CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(until);`);
  const deleteExpired = db.prepare('DELETE FROM rate_limits WHERE until <= ?');
  const selectEntry = db.prepare('SELECT count, until FROM rate_limits WHERE key = ?');
  const countEntries = db.prepare('SELECT count(*) AS count FROM rate_limits');
  const upsertEntry = db.prepare(
    `INSERT INTO rate_limits VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN until <= ? THEN 1 ELSE count + 1 END,
      until = CASE WHEN until <= ? THEN excluded.until ELSE until END`,
  );
  let nextCleanup = 0;

  const enforce = (requests: readonly RateLimitRequest[], now = Date.now()) => {
    let rejection: ApiError | undefined;
    transaction(db, () => {
      if (now >= nextCleanup) {
        deleteExpired.run(now);
        nextCleanup = now + 60000;
      }

      for (const [key, maximum] of requests) {
        const digest = hash(key);
        const entry = selectEntry.get(digest) as { count: number; until: number } | undefined;

        if (entry && entry.until > now && entry.count >= maximum) {
          rejection = new ApiError(429, '尝试次数过多，请 15 分钟后再试。');

          break;
        }

        if (!entry) {
          const { count } = countEntries.get() as { count: number };

          if (count >= capacity) {
            // Reclaim expired keys on capacity pressure, even between maintenance passes.
            deleteExpired.run(now);
            const remaining = countEntries.get() as { count: number };

            if (remaining.count >= capacity) {
              rejection = new ApiError(429, '请求过多，请稍后重试。');

              break;
            }
          }
        }

        upsertEntry.run(digest, now + 15 * 60000, now, now);
      }
    });

    if (rejection) {
      throw rejection;
    }
  };

  const limit = ((key: string, maximum: number, now?: number) =>
    enforce([[key, maximum]], now)) as RateLimiter;
  limit.many = enforce;

  return limit;
}
