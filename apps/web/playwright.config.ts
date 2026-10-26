import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
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
      env: { API_PORT: '8788', FAMILY_DB: ':memory:', APP_ORIGIN: 'http://127.0.0.1:4173' },
      url: 'http://127.0.0.1:8788/api/health',
      reuseExistingServer: false,
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:8788' },
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
  ],
});
