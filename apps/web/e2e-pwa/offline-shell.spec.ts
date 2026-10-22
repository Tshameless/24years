import { expect, test } from '@playwright/test';

test('离线刷新和首次打开其他路由仍可用，缓存不含 API 或版本数据', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tasks');
  await expect(page.getByRole('heading', { name: '日常计划', exact: true })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => fetch('/api/session'));
  await page.evaluate(() => fetch('/version.json'));
  const cachePaths = await page.evaluate(async () => {
    const names = (await caches.keys()).filter((key) => key.startsWith('24years-app-shell-'));
    const cache = await caches.open(names[0]!);

    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cachePaths).toContain('/');
  expect(cachePaths.some((path) => path.startsWith('/assets/'))).toBe(true);
  expect(cachePaths.some((path) => path.startsWith('/api/'))).toBe(false);
  expect(cachePaths).not.toContain('/version.json');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '日常计划', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '当前离线' })).toBeVisible();
  await expect(page).toHaveTitle(/24Years/);
  const staticResponses = await page.evaluate(async () =>
    Promise.all(
      ['/favicon.svg', '/manifest.webmanifest'].map(async (path) => (await fetch(path)).ok),
    ),
  );
  expect(staticResponses).toEqual([true, true]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: test.info().outputPath('offline-tasks.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/ledger');
  await expect(page.getByRole('heading', { name: '家庭账本', exact: true })).toBeVisible();
  expect(errors).toEqual([]);

  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: '当前离线' })).toHaveCount(0);
});

test('同步模式离线冷启动显示不可用提示，不冒用本机档案', async ({ page, context }) => {
  await page.goto('/tasks');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.evaluate(() => localStorage.setItem('24years.cloud.active', 'true'));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: '无法连接云端' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '云端家庭数据未缓存' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '日常计划', exact: true })).toBeVisible();
});
