import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clientAddress, createRateLimiter } from './rate-limit.ts';
import { openDatabase } from './database.ts';
import { createApplication } from './http.ts';
import { createService } from './service.ts';
import { emptyFamily } from '../src/domain/family.ts';
import { pruneBackups } from './backup-retention.ts';
import { compressionEncoding } from './compression.ts';

test('compression negotiation respects quality, exclusions and identity', () => {
  assert.equal(compressionEncoding(), undefined);
  assert.equal(compressionEncoding('gzip, br'), 'br');
  assert.equal(compressionEncoding('gzip;q=1, br;q=0.5'), 'gzip');
  assert.equal(compressionEncoding('*;q=1, br;q=0'), 'gzip');
  assert.equal(compressionEncoding('br;q=0, gzip;q=0'), undefined);
  assert.equal(compressionEncoding('gzip;q=0.5, identity;q=1'), undefined);
  assert.equal(compressionEncoding('br;q=invalid, gzip;q=2'), undefined);
});

test('only trusted proxies can supply an address; nearest appended IP wins', () => {
  assert.equal(clientAddress('10.0.0.1', '1.2.3.4', []), '10.0.0.1');
  assert.equal(clientAddress('::ffff:127.0.0.1', 'fake, 1.2.3.4', ['127.0.0.1']), '1.2.3.4');
  assert.equal(clientAddress('127.0.0.1', 'invalid', ['127.0.0.1']), '127.0.0.1');
});

test('rate limit survives recreation, caps keys and expires', () => {
  const db = openDatabase(':memory:');

  try {
    const limit = createRateLimiter(db, 2);
    limit('a', 1, 100);
    assert.throws(() => createRateLimiter(db, 2)('a', 1, 101));
    limit('b', 1, 102);
    assert.throws(() => limit('c', 1, 103));
    limit('c', 1, 1000000);
    const rows = db.prepare('SELECT count(*) AS n FROM rate_limits').get() as { n: number };
    assert.equal(rows.n, 1);
  } finally {
    db.close();
  }
});

test('session validators track invite expiry, revisions and membership without decoding data', async () => {
  const db = openDatabase(':memory:');

  try {
    const service = createService(db);
    const { state } = await service.authenticate(
      { username: 'tags', nickname: 'Tags', password: 'password-12345' },
      true,
    );
    const id = state.user!.id;
    const initial = service.sessionTag(id);
    const family = service.mutate(id, 'create', {
      mode: 'couple',
      familyRole: 'mother',
      data: emptyFamily(),
    }).family!;
    assert.notEqual(service.sessionTag(id), initial);
    db.prepare('INSERT INTO invites VALUES (?, ?, ?)').run(
      'invite-hash',
      family.id,
      Date.now() + 60000,
    );
    const invited = service.sessionTag(id);
    db.prepare('UPDATE invites SET expires_at = 0').run();
    assert.notEqual(service.sessionTag(id), invited);
    const tag = service.sessionTag(id);
    db.prepare('UPDATE families SET data = ? WHERE id = ?').run('invalid-json', family.id);
    assert.equal(service.sessionTag(id), tag);
    db.prepare('UPDATE families SET revision = revision + 1 WHERE id = ?').run(family.id);
    assert.notEqual(service.sessionTag(id), tag);
    db.prepare('DELETE FROM members WHERE user_id = ?').run(id);
    assert.equal(service.sessionTag(id), initial);
  } finally {
    db.close();
  }
});

test('blocked attempts do not write and expired windows reset between cleanup passes', () => {
  const db = openDatabase(':memory:');

  try {
    const limit = createRateLimiter(db);
    limit('a', 1, 100);
    const changes = db.prepare('SELECT total_changes() AS n').get();
    for (let i = 0; i < 20; i++) {
      assert.throws(() => limit('a', 1, 101 + i));
    }
    assert.deepEqual(db.prepare('SELECT total_changes() AS n').get(), changes);
    limit('b', 1, 900000); // Maintenance runs just before a expires.
    limit('a', 1, 900101);
    const rows = db.prepare('SELECT count, until FROM rate_limits ORDER BY until').all() as Array<{
      count: number;
      until: number;
    }>;
    assert.deepEqual(
      rows.map((row) => row.count),
      [1, 1],
    );
    assert.equal(rows[1].until, 1800101);
  } finally {
    db.close();
  }
});

test('startup removes old receipts and retains indexed recent receipts', async () => {
  const directory = mkdtempSync(join(tmpdir(), '24years-receipts-'));
  const database = join(directory, 'family.sqlite');
  const db = openDatabase(database);
  const service = createService(db);
  const registered = await service.authenticate(
    { username: 'receipts', nickname: 'User', password: 'password-12345' },
    true,
  );
  const family = service.mutate(registered.state.user!.id, 'create', {
    mode: 'single',
    familyRole: 'single_parent',
    data: emptyFamily(),
  }).family!;
  const insert = db.prepare(
    'INSERT INTO receipts (user_id, family_id, operation_id, payload_hash, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  insert.run(registered.state.user!.id, family.id, 'old', 'hash', Date.now() - 31 * 86400000);
  insert.run(registered.state.user!.id, family.id, 'recent', 'hash', Date.now());
  db.prepare('INSERT INTO import_backups VALUES (?, ?, ?)').run(
    family.id,
    JSON.stringify(emptyFamily()),
    new Date(Date.now() - 31 * 86400000).toISOString(),
  );
  db.close();
  const app = createApplication({ database });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));

  try {
    const receipts = app.db.prepare('SELECT operation_id FROM receipts').all() as Array<{
      operation_id: string;
    }>;
    assert.deepEqual(
      receipts.map((row) => row.operation_id),
      ['recent'],
    );
    const expiredBackups = app.db.prepare('SELECT count(*) AS count FROM import_backups').get() as {
      count: number;
    };
    assert.equal(expiredBackups.count, 0);
    const indexes = app.db.prepare("PRAGMA index_list('receipts')").all() as Array<{
      name: string;
    }>;
    assert.ok(indexes.some((row) => row.name === 'receipts_created_at'));
  } finally {
    await new Promise<void>((resolve) => app.server.close(() => resolve()));
    app.db.close();
    rmSync(directory, { recursive: true });
  }
});

test('HTTP uses 304, immutable assets, CSP and 404 for missing chunks', async () => {
  const directory = mkdtempSync(join(tmpdir(), '24years-http-'));
  mkdirSync(join(directory, 'assets'));
  writeFileSync(join(directory, 'index.html'), '<html></html>');
  writeFileSync(join(directory, 'assets', 'index-12345678.js'), 'export {};');
  const largeScript = 'export const value = "' + 'compressible-content '.repeat(200) + '";';
  writeFileSync(join(directory, 'assets', 'large-12345678.js'), largeScript);
  const app = createApplication({ database: ':memory:', staticDir: directory });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;

  try {
    for (const encoding of ['br', 'gzip', 'identity']) {
      const response = await fetch(base + '/assets/large-12345678.js', {
        headers: { 'Accept-Encoding': encoding },
      });
      assert.equal(
        response.headers.get('content-encoding'),
        encoding === 'identity' ? null : encoding,
      );
      assert.equal(response.headers.get('vary'), 'Accept-Encoding');
      // Fetch decodes the compressed stream; invalid/truncated streams fail here.
      assert.equal(await response.text(), largeScript);
      const unchanged = await fetch(base + '/assets/large-12345678.js', {
        headers: { 'Accept-Encoding': encoding, 'If-None-Match': response.headers.get('etag')! },
      });
      assert.equal(unchanged.status, 304);
      assert.equal(unchanged.headers.get('vary'), 'Accept-Encoding');
      assert.equal(unchanged.headers.get('content-encoding'), null);
    }

    for (const path of ['/api/session', '/', '/assets/index-12345678.js']) {
      const first = await fetch(base + path);
      assert.equal(first.status, 200);
      assert.ok(first.headers.get('content-security-policy'));
      assert.equal(first.headers.get('content-encoding'), null);
      const second = await fetch(base + path, {
        headers: { 'If-None-Match': first.headers.get('etag')! },
      });
      assert.equal(second.status, 304);
      assert.equal(await second.text(), '');

      if (path.startsWith('/assets')) {
        assert.match(first.headers.get('cache-control')!, /immutable/);
      }
    }
    assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
    const service = createService(app.db);
    const registered = await service.authenticate(
      { username: 'etaguser', nickname: 'User', password: 'password-12345' },
      true,
    );
    const cookie = `family_session=${registered.token}`;
    const data = emptyFamily();
    data.tasks = Array.from({ length: 40 }, (_, i) => ({
      id: `task${i}`,
      title: `Task ${i}`,
      date: '2026-10-22',
      time: '10:00',
      repeat: 'once',
      completedDates: [],
    }));
    const expected = service.mutate(registered.state.user!.id, 'create', {
      mode: 'single',
      familyRole: 'single_parent',
      data,
    });
    for (const encoding of ['br', 'gzip', 'identity']) {
      const response = await fetch(base + '/api/session', {
        headers: { Cookie: cookie, 'Accept-Encoding': encoding },
      });
      assert.equal(
        response.headers.get('content-encoding'),
        encoding === 'identity' ? null : encoding,
      );
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('vary'), 'Cookie, Accept-Encoding');
      assert.deepEqual(await response.json(), JSON.parse(JSON.stringify(expected)));
      const unchanged = await fetch(base + '/api/session', {
        headers: {
          Cookie: cookie,
          'Accept-Encoding': encoding,
          'If-None-Match': response.headers.get('etag')!,
        },
      });
      assert.equal(unchanged.status, 304);
      assert.equal(unchanged.headers.get('vary'), 'Cookie, Accept-Encoding');
      assert.equal(await unchanged.text(), '');
    }
    const session = await fetch(base + '/api/session', { headers: { Cookie: cookie } });
    const unauthEvents = await fetch(base + '/api/events');
    assert.equal(unauthEvents.status, 401);
    const abortController = new AbortController();
    const eventsResponse = await fetch(base + '/api/events', {
      headers: { Cookie: cookie },
      signal: abortController.signal,
    });
    assert.equal(eventsResponse.status, 200);
    assert.match(eventsResponse.headers.get('content-type')!, /^text\/event-stream/);
    const reader = eventsResponse.body!.getReader();
    const decoder = new TextDecoder();
    const initialChunk = decoder.decode((await reader.read()).value);
    assert.match(initialChunk, /event: ready/);
    const syncRead = reader.read();
    const mutated = await fetch(base + '/api/family/records', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-24Years-Client': 'web',
      },
      body: JSON.stringify({
        familyId: expected.family!.id,
        operationId: 'sse-notify-op-001',
        change: {
          type: 'task',
          before: null,
          value: {
            id: 'sse-task',
            title: 'SSE Task',
            date: '2026-10-26',
            time: '09:00',
            repeat: 'once',
            completedDates: [],
          },
        },
      }),
    });
    assert.equal(mutated.status, 200);
    const syncChunk = decoder.decode((await syncRead).value);
    assert.match(syncChunk, /event: sync/);
    abortController.abort();

    const latestSession = await fetch(base + '/api/session', { headers: { Cookie: cookie } });
    service.logout(registered.token);
    const expired = await fetch(base + '/api/session', {
      headers: { Cookie: cookie, 'If-None-Match': latestSession.headers.get('etag')! },
    });
    assert.equal(expired.status, 200);
    assert.equal((await expired.json()).user, null);
  } finally {
    await new Promise<void>((resolve, reject) =>
      app.server.close((error) => (error ? reject(error) : resolve())),
    );
    app.db.close();
    rmSync(directory, { recursive: true });
  }
});

test('retention preserves newest copies, manual files and verifies before deletion', () => {
  const directory = mkdtempSync(join(tmpdir(), '24years-retention-'));

  try {
    const paths = Array.from({ length: 4 }, (_, i) =>
      join(directory, `family-2026-01-0${i + 1}T00-00-00-000Z-12345678.sqlite`),
    );
    for (const [i, path] of paths.entries()) {
      openDatabase(path).close();
      utimesSync(path, 100 + i, 100 + i);
    }
    const manual = join(directory, 'manual.sqlite');
    writeFileSync(manual, 'keep');
    assert.throws(() => pruneBackups(directory, manual, 1, 2));
    assert.equal(pruneBackups(directory, paths[3], 1, 2).length, 2);
    assert.ok(existsSync(paths[2]));
    assert.ok(existsSync(paths[3]));
    assert.ok(existsSync(manual));
  } finally {
    rmSync(directory, { recursive: true });
  }
});
