import { fileURLToPath } from 'node:url';
import { createApplication } from './http.ts';

const { server, db } = createApplication({
  database:
    process.env.FAMILY_DB ?? fileURLToPath(new URL('../data/family.sqlite', import.meta.url)),
  staticDir: fileURLToPath(new URL('../dist', import.meta.url)),
  origin: process.env.APP_ORIGIN,
  secureCookie: process.env.COOKIE_SECURE === 'true',
  trustedProxies: process.env.TRUSTED_PROXIES?.split(',')
    .map((value) => value.trim())
    .filter(Boolean),
});
const port = Number(process.env.API_PORT ?? 8787);

server.listen(port, process.env.API_HOST ?? '127.0.0.1', () => {
  console.log(`24Years service listening on port ${port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
