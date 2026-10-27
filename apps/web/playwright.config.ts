import { defineConfig, devices } from '@playwright/test';

const apiPort = process.env.PLAYWRIGHT_API_PORT ?? '8788';
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? '4173';
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  workers: 4,
  retries: 1,
  fullyParallel: true,
  use: {
    baseURL: webOrigin,
    timezoneId: 'Asia/Shanghai',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node server/index.ts',
      env: { API_PORT: apiPort, FAMILY_DB: ':memory:', APP_ORIGIN: webOrigin },
      url: `${apiOrigin}/api/health`,
      reuseExistingServer: false,
    },
    {
      command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${webPort} --strictPort`,
      env: { API_PROXY_TARGET: apiOrigin },
      url: webOrigin,
      reuseExistingServer: false,
    },
  ],
});
