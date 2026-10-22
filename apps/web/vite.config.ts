import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const version = randomUUID();
const serviceWorkerTemplate = readFileSync(
  fileURLToPath(new URL('./service-worker.template.js', import.meta.url)),
  'utf8',
);

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  plugins: [
    vue(),
    {
      name: 'app-version',
      apply: 'build',
      generateBundle(_options, bundle) {
        const precacheAssets = Object.values(bundle)
          .filter(
            (output) =>
              output.type === 'chunk' ||
              (output.type === 'asset' && output.fileName.endsWith('.css')),
          )
          .map((output) => `/${output.fileName}`);
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ version }),
        });
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: serviceWorkerTemplate
            .replace('__APP_VERSION__', version)
            .replace('__PRECACHE_ASSETS__', JSON.stringify(precacheAssets)),
        });
      },
    },
  ],
  server: {
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8787',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
