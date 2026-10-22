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

test('HTTP uses 304, immutable assets, CSP and 404 for missing chunks', async () => {
  const directory = mkdtempSync(join(tmpdir(), '24years-http-'));
  mkdirSync(join(directory, 'assets'));
  writeFileSync(join(directory, 'index.html'), '<html></html>');
  writeFileSync(join(directory, 'assets', 'index-12345678.js'), 'export {};');
  const app = createApplication({ database: ':memory:', staticDir: directory });
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const address = app.server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;

  try {
    for (const path of ['/api/session', '/', '/assets/index-12345678.js']) {
      const first = await fetch(base + path);
      assert.equal(first.status, 200);
      assert.ok(first.headers.get('content-security-policy'));
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
    const session = await fetch(base + '/api/session', { headers: { Cookie: cookie } });
    service.logout(registered.token);
    const expired = await fetch(base + '/api/session', {
      headers: { Cookie: cookie, 'If-None-Match': session.headers.get('etag')! },
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
