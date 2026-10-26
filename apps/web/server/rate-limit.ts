import { isIP } from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import { ApiError, hash } from './service.ts';

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
  let nextCleanup = 0;

  return (key: string, maximum: number, now = Date.now()) => {
    const digest = hash(key);

    if (now >= nextCleanup) {
      db.prepare('DELETE FROM rate_limits WHERE until <= ?').run(now);
      nextCleanup = now + 60000;
    }

    const entry = db.prepare('SELECT count, until FROM rate_limits WHERE key = ?').get(digest) as
      | { count: number; until: number }
      | undefined;

    if (entry && entry.until > now && entry.count >= maximum) {
      throw new ApiError(429, '尝试次数过多，请 15 分钟后再试。');
    }

    if (!entry) {
      const { count } = db.prepare('SELECT count(*) AS count FROM rate_limits').get() as {
        count: number;
      };

      if (count >= capacity) {
        // Reclaim expired keys on capacity pressure, even between maintenance passes.
        db.prepare('DELETE FROM rate_limits WHERE until <= ?').run(now);
        const remaining = db.prepare('SELECT count(*) AS count FROM rate_limits').get() as {
          count: number;
        };

        if (remaining.count >= capacity) {
          throw new ApiError(429, '请求过多，请稍后重试。');
        }
      }
    }

    db.prepare(
      `INSERT INTO rate_limits VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        count = CASE WHEN until <= ? THEN 1 ELSE count + 1 END,
        until = CASE WHEN until <= ? THEN excluded.until ELSE until END`,
    ).run(digest, now + 15 * 60000, now, now);
  };
}
