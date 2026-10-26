import { createReadStream, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import { constants, createBrotliCompress, createGzip } from 'node:zlib';
import { ApiError } from './auth.ts';
import { compressionEncoding } from './compression.ts';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

export function serveStatic(
  staticDir: string,
  path: string,
  request: IncomingMessage,
  response: ServerResponse,
): boolean {
  const root = resolve(staticDir);
  const candidate = resolve(root, `.${decodeURIComponent(path)}`);

  if (candidate !== root && !candidate.startsWith(root + sep)) {
    throw new ApiError(404, '页面不存在。');
  }

  const candidateStat = statSync(candidate, { throwIfNoEntry: false });
  const isCandidateFile = candidateStat?.isFile() ?? false;
  const file = isCandidateFile ? candidate : resolve(root, 'index.html');

  if (!isCandidateFile && (path.startsWith('/assets/') || path === '/version.json')) {
    throw new ApiError(404, '资源不存在。');
  }

  const stat = isCandidateFile ? candidateStat! : statSync(file, { throwIfNoEntry: false });

  if (!stat?.isFile()) {
    return false;
  }
  const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
  response.setHeader('ETag', etag);
  const compressible = /\.(?:html|js|css|svg|json|webmanifest)$/.test(file);
  const encoding =
    compressible && stat.size >= 1024
      ? compressionEncoding(request.headers['accept-encoding'])
      : undefined;

  if (compressible) {
    response.setHeader('Vary', 'Accept-Encoding');
  }

  response.setHeader(
    'Cache-Control',
    file === candidate && /^\/assets\/.+-[\w-]{8,}\.[\w]+$/.test(path)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  );

  if (request.headers['if-none-match'] === etag) {
    response.writeHead(304);
    response.end();

    return true;
  }

  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(file)] ?? 'application/octet-stream',
    ...(encoding ? { 'Content-Encoding': encoding } : {}),
  });
  const source = createReadStream(file);
  const onError = (error: NodeJS.ErrnoException | null) => {
    if (error && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error('Static response failed:', error);
    }
  };

  if (encoding) {
    pipeline(
      source,
      encoding === 'br'
        ? createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
        : createGzip(),
      response,
      onError,
    );
  } else {
    pipeline(source, response, onError);
  }

  return true;
}
