import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { ApiError, createService } from './service.ts';
import { openDatabase } from './database.ts';
import { clientAddress, createRateLimiter } from './rate-limit.ts';

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
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.writeHead(status);
  response.end(JSON.stringify(value));
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
  const cleanup = () => {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    db.prepare('DELETE FROM invites WHERE expires_at <= ?').run(Date.now());
    db.prepare('DELETE FROM rate_limits WHERE until <= ?').run(Date.now());
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
      const path = new URL(request.url ?? '/', 'http://localhost').pathname;
      userId = service.userForToken(token);

      if (path === '/api/health' && request.method === 'GET') {
        db.prepare('SELECT 1').get();
        json(response, 200, { ok: true });

        return;
      }

      if (path === '/api/session' && request.method === 'GET') {
        const etag = service.sessionTag(userId);
        response.setHeader('ETag', etag);
        response.setHeader('Cache-Control', 'private, no-cache');
        response.setHeader('Vary', 'Cookie');

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
          limit(`recovery-account:${String(body.username).toLowerCase()}`, 6);
          const result = await service.recover(body);
          service.logout(token);
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
          response.setHeader(
            'Set-Cookie',
            `family_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${options.secureCookie ? '; Secure' : ''}`,
          );
          json(response, 200, { user: null, family: null });

          return;
        }

        if (path === '/api/account/recovery' || path === '/api/account/delete') {
          limit(`security:${userId}`, 6);
          const result = path.endsWith('/recovery')
            ? await service.rotateRecovery(userId, body)
            : await service.deleteAccount(userId, body);

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

        json(response, 200, service.mutate(userId, action, body));

        return;
      }

      if (options.staticDir && request.method === 'GET') {
        const root = resolve(options.staticDir);
        const candidate = resolve(root, `.${decodeURIComponent(path)}`);

        if (candidate !== root && !candidate.startsWith(root + sep)) {
          throw new ApiError(404, '页面不存在。');
        }

        const file =
          existsSync(candidate) && statSync(candidate).isFile()
            ? candidate
            : resolve(root, 'index.html');

        if (file !== candidate && (path.startsWith('/assets/') || path === '/version.json')) {
          throw new ApiError(404, '资源不存在。');
        }

        const mime: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.woff2': 'font/woff2',
          '.webmanifest': 'application/manifest+json; charset=utf-8',
        };

        if (existsSync(file)) {
          const stat = statSync(file);
          const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
          response.setHeader('ETag', etag);
          response.setHeader(
            'Cache-Control',
            file === candidate && /^\/assets\/.+-[\w-]{8,}\.[\w]+$/.test(path)
              ? 'public, max-age=31536000, immutable'
              : 'no-cache',
          );

          if (request.headers['if-none-match'] === etag) {
            response.writeHead(304);
            response.end();

            return;
          }

          response.writeHead(200, {
            'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
          });
          createReadStream(file).pipe(response);

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
  server.once('close', () => clearInterval(maintenance));

  return { server, db };
}
