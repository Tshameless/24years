import { expect, test } from '@playwright/test';

async function register(page: import('@playwright/test').Page) {
  const username = `p${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}`;
  await page.goto('/family');
  await page.getByLabel('同步账号', { exact: true }).fill(username);
  await page.getByLabel('成员称呼').fill('小叶');
  await page.getByLabel('账号密码').fill('family-test-password');
  await page.getByRole('button', { name: '注册并开启同步' }).click();
  await expect(page.getByRole('heading', { name: '我的同步账号' })).toBeVisible();
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('离线快照家庭');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByLabel('天数（天）').selectOption('3');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  // Creating the first cloud family changes scope and remounts the form.
  await expect(page.getByRole('heading', { name: '家庭档案', exact: true })).toBeVisible();
  await expect(page.getByLabel('家庭名称')).toHaveValue('离线快照家庭');
  await expect(page.getByRole('button', { name: '保存家庭档案' })).toBeEnabled();
}

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
  await expect(page.getByRole('status').filter({ hasText: '没有可用的家庭快照' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '日常计划', exact: true })).toBeVisible();
});

test('已同步云端记录断网刷新后可只读查看，恢复连接后重新开放编辑', async ({ page, context }) => {
  await register(page);
  await page.goto('/tasks');
  await page.getByLabel('计划名称').fill('医院待办');
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expect(page.getByText('医院待办', { exact: true })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('医院待办', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '最近同步的只读快照' })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存计划', exact: true })).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: '无法连接云端' })).toHaveCount(0, {
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: '保存计划', exact: true })).toBeEnabled();
});
