import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pipeline, Readable } from 'node:stream';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';
import { ApiError, createService } from './service.ts';
import { openDatabase } from './database.ts';
import { clientAddress, createRateLimiter } from './rate-limit.ts';
import { compressionEncoding } from './compression.ts';
import { serveStatic } from './static.ts';

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!request.headers['content-type']?.startsWith('application/json')) {
    throw new ApiError(415, '请使用 JSON 提交。');
  }

  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;

    if (size > 1024 * 1024) {
      throw new ApiError(413, '提交内容过大。');
    }

    chunks.push(chunk);
  }

  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString());

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid body');
    }

    return value as Record<string, unknown>;
  } catch {
    throw new ApiError(400, '提交内容不是有效 JSON。');
  }
}

function json(response: ServerResponse, status: number, value: unknown) {
  const payload = JSON.stringify(value);
  const encoding =
    Buffer.byteLength(payload) >= 1024
      ? compressionEncoding(response.req.headers['accept-encoding'])
      : undefined;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  const vary = response.getHeader('Vary');
  const fields = new Set(
    String(vary ?? '')
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean),
  );
  fields.add('Accept-Encoding');
  response.setHeader('Vary', [...fields].join(', '));

  if (encoding) {
    response.setHeader('Content-Encoding', encoding);
    response.writeHead(status);
    pipeline(
      Readable.from([payload]),
      encoding === 'br'
        ? createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
        : createGzip(),
      response,
      (error) => {
        if (error) {
          response.destroy(error);
        }
      },
    );

    return;
  }

  response.writeHead(status);
  response.end(payload);
}

export function createApplication(options: {
  database: string;
  staticDir?: string;
  origin?: string;
  secureCookie?: boolean;
  trustedProxies?: string[];
}) {
  const db = openDatabase(options.database);
  const service = createService(db);
  const limit = createRateLimiter(db);
  const selectAccountByUsername = db.prepare('SELECT id FROM accounts WHERE username = ?');
  const eventClients = new Set<{ userId: string; response: ServerResponse }>();

  function familyUsers(userId: string): string[] {
    const state = service.snapshot(userId);
    const members = state.family?.members.map((member) => member.id) ?? [];

    return [...new Set([userId, ...members])];
  }

  function notifyUsers(userIds: Iterable<string>, fromRevision?: number) {
    const targets = new Set(userIds);

    for (const client of eventClients) {
      if (targets.has(client.userId) && !client.response.writableEnded) {
        const payload =
          fromRevision !== undefined
            ? JSON.stringify({
                delta: service.changesSince(client.userId, fromRevision),
                etag: service.sessionTag(client.userId),
              })
            : String(Date.now());
        client.response.write(`event: sync\ndata: ${payload}\n\n`);
      }
    }
  }

  const cleanup = () => {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('DELETE FROM invites WHERE expires_at <= ?').run(Date.now());
    db.prepare('DELETE FROM rate_limits WHERE until <= ?').run(Date.now());
    // Retain receipts and incremental change logs for 30 days, matching the maximum session lifetime.
    db.prepare('DELETE FROM receipts WHERE created_at <= ?').run(Date.now() - 30 * 86400000);
    db.prepare('DELETE FROM family_changes WHERE created_at <= ?').run(Date.now() - 30 * 86400000);
    // An import backup is an undo safety net, not an archive. Retain it for 30 days.
    db.prepare('DELETE FROM import_backups WHERE created_at <= ?').run(
      new Date(Date.now() - 30 * 86400000).toISOString(),
    );
  };
  cleanup();
  const maintenance = setInterval(() => {
    try {
      cleanup();
    } catch (error) {
      console.error('Database maintenance failed:', error);
    }
  }, 60 * 60000);
  maintenance.unref();
  const heartbeat = setInterval(() => {
    for (const client of eventClients) {
      if (!client.response.writableEnded) {
        client.response.write(': ping\n\n');
      }
    }
  }, 25000);
  heartbeat.unref();

  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    );
    const token =
      request.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('family_session='))
        ?.slice('family_session='.length) ?? '';
    let userId: string | null = null;

    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost');
      const path = requestUrl.pathname;
      userId = service.userForToken(token);

      if (path === '/api/health' && request.method === 'GET') {
        db.prepare('SELECT 1').get();
        json(response, 200, { ok: true });

        return;
      }

      if (path === '/api/family/changes' && request.method === 'GET') {
        if (!userId) {
          throw new ApiError(401, '登录已过期，请重新登录后继续。');
        }

        const since = Number(requestUrl.searchParams.get('since'));

        if (!Number.isInteger(since) || since < 1) {
          throw new ApiError(400, '请提供有效的起始版本号。');
        }

        json(response, 200, {
          delta: service.changesSince(userId, since),
          etag: service.sessionTag(userId),
        });

        return;
      }

      if (path === '/api/events' && request.method === 'GET') {
        if (!userId) {
          throw new ApiError(401, '登录已过期，请重新登录后继续。');
        }

        request.socket.setTimeout(0);
        request.socket.setNoDelay(true);
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'private, no-store, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        response.write(`event: ready\ndata: ${service.sessionTag(userId)}\n\n`);
        const client = { userId, response };
        eventClients.add(client);
        const removeClient = () => {
          eventClients.delete(client);
        };
        request.once('close', removeClient);
        response.once('close', removeClient);

        return;
      }

      if (path === '/api/session' && request.method === 'GET') {
        const etag = service.sessionTag(userId);
        response.setHeader('ETag', etag);
        response.setHeader('Cache-Control', 'private, no-cache');
        response.setHeader('Vary', 'Cookie, Accept-Encoding');

        if (request.headers['if-none-match'] === etag) {
          response.writeHead(304);
          response.end();

          return;
        }

        json(response, 200, userId ? service.snapshot(userId) : { user: null, family: null });

        return;
      }

      if (path.startsWith('/api/')) {
        if (request.method !== 'POST') {
          throw new ApiError(405, '此接口只接受 POST。');
        }

        // The custom header cannot be sent by a cross-origin HTML form. No CORS is enabled.
        const allowedOrigin = options.origin ?? `http://${request.headers.host}`;

        if (
          request.headers['x-24years-client'] !== 'web' ||
          (request.headers.origin && request.headers.origin !== allowedOrigin)
        ) {
          throw new ApiError(403, '请求来源不受信任。');
        }

        const body = await readBody(request);
        const forwarded = request.headers['x-forwarded-for'];
        const ip = clientAddress(
          request.socket.remoteAddress ?? 'unknown',
          typeof forwarded === 'string' ? forwarded : undefined,
          options.trustedProxies ?? [],
        );

        if (path === '/api/recover') {
          limit(`recovery-ip:${ip}`, 30);
          const targetUsername = String(body.username).toLowerCase();
          limit(`recovery-account:${targetUsername}`, 6);
          const targetAccount = selectAccountByUsername.get(targetUsername) as
            | { id: string }
            | undefined;
          const result = await service.recover(body);
          service.logout(token);

          if (targetAccount) {
            notifyUsers([targetAccount.id]);
          }

          response.setHeader(
            'Set-Cookie',
            `family_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${options.secureCookie ? '; Secure' : ''}`,
          );
          json(response, 200, result);

          return;
        }

        if (path === '/api/register' || path === '/api/login') {
          limit(`auth-ip:${ip}`, 100);
          limit(`auth-account:${String(body.username).toLowerCase()}`, 12);
          const result = await service.authenticate(body, path === '/api/register');
          service.logout(token);
          response.setHeader(
            'Set-Cookie',
            `family_session=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${options.secureCookie ? '; Secure' : ''}`,
          );
          json(response, 200, result.state);

          return;
        }

        if (!userId) {
          throw new ApiError(401, '登录已过期，请重新登录后继续。');
        }

        if (path === '/api/logout') {
          service.logout(token);
          notifyUsers([userId]);
          response.setHeader(
            'Set-Cookie',
            `family_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${options.secureCookie ? '; Secure' : ''}`,
          );
          json(response, 200, { user: null, family: null });

          return;
        }

        if (
          path === '/api/account/recovery' ||
          path === '/api/account/change-password' ||
          path === '/api/account/delete'
        ) {
          limit(`security:${userId}`, 6);
          const affectedUsers = familyUsers(userId);
          const result = path.endsWith('/recovery')
            ? await service.rotateRecovery(userId, body)
            : path.endsWith('/change-password')
              ? await service.changePassword(userId, token, body)
              : await service.deleteAccount(userId, body);
          notifyUsers(affectedUsers);

          if (path.endsWith('/delete')) {
            response.setHeader(
              'Set-Cookie',
              `family_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${options.secureCookie ? '; Secure' : ''}`,
            );
          }

          json(response, 200, result);

          return;
        }

        const action = path.replace('/api/family/', '');

        if (!path.startsWith('/api/family/')) {
          throw new ApiError(404, '接口不存在。');
        }

        if (action === 'join' || action === 'invite') {
          limit(`pair:${userId}`, 12);
          limit(`pair-ip:${ip}`, 60);
        }

        const beforeFamily = service.snapshot(userId).family;
        const beforeUsers = familyUsers(userId);
        const result = service.mutate(userId, action, body);
        const afterUsers = result.family?.members.map((member) => member.id) ?? [];
        notifyUsers([...beforeUsers, ...afterUsers], beforeFamily?.revision);
        json(response, 200, result);

        return;
      }

      if (options.staticDir && request.method === 'GET') {
        if (serveStatic(options.staticDir, path, request, response)) {
          return;
        }
      }

      throw new ApiError(404, '页面不存在。');
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;

      if (status === 500) {
        console.error('API request failed:', error);
      }

      json(response, status, {
        message: error instanceof ApiError ? error.message : '服务暂时无法保存，请稍后重试。',
        ...(status === 409 && userId ? { state: service.snapshot(userId) } : {}),
      });
    }
  });
  server.requestTimeout = 15000;
  const originalClose = server.close.bind(server);
  server.close = ((callback?: (error?: Error) => void) => {
    for (const client of eventClients) {
      client.response.end();
    }

    eventClients.clear();

    return originalClose(callback);
  }) as typeof server.close;
  server.once('close', () => {
    clearInterval(maintenance);
    clearInterval(heartbeat);
  });

  return { server, db };
}
