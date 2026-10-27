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

test('已同步云端记录断网后仍可排队保存，恢复连接后自动同步', async ({ page, context }) => {
  await register(page);
  await page.goto('/tasks');
  await page.getByLabel('计划名称').fill('医院待办');
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expect(page.getByText('医院待办', { exact: true })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('医院待办', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '当前可排队保存记录' })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存计划', exact: true })).toBeEnabled();
  await page.getByLabel('计划名称').fill('离线待办');
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expect(page.getByText('离线待办', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '1 条未同步记录' })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: '无法连接云端' })).toHaveCount(0, {
    timeout: 10000,
  });
  await expect(page.getByRole('status').filter({ hasText: '条未同步记录' })).toHaveCount(0, {
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: '保存计划', exact: true })).toBeEnabled();
  await expect(page.getByText('离线待办', { exact: true })).toBeVisible();
});

test('产后首页直达孩子档案，侧栏与账本图表均可用且无横向溢出', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem(
      '24years.family.v1',
      JSON.stringify({
        version: 1,
        profile: {
          name: '小满的家',
          nickname: '家长',
          dueDate: '2027-06-01',
          quietMode: false,
        },
        tasks: [],
        expenses: [
          {
            id: 'medical',
            title: '产检',
            date: '2026-10-26',
            kind: 'expense',
            category: '产检医疗',
            amountCents: 10000,
            reimbursedCents: 0,
          },
          {
            id: 'baby-goods',
            title: '尿布',
            date: '2026-10-27',
            kind: 'expense',
            category: '宝宝用品',
            amountCents: 20000,
            reimbursedCents: 0,
          },
        ],
        theme: 'light',
        pregnancyRecords: [
          {
            id: 'pregnancy-outcome',
            type: 'outcome',
            kind: 'birth',
            date: '2026-10-26',
            mode: 'unknown',
            babyName: '小满',
            notes: '',
          },
        ],
        children: [
          {
            id: 'birth-pregnancy-outcome',
            name: '小满',
            birthDate: '2026-10-26',
            sourceOutcomeId: 'pregnancy-outcome',
          },
        ],
      }),
    );
  });
  await page.reload();
  await expect(page.getByRole('link', { name: '孩子成长档案' })).toBeVisible();
  await expect(page.locator('.primary-nav a')).toHaveCount(6);
  await page.getByRole('link', { name: '孩子成长档案' }).click();
  await expect(page).toHaveURL(/\/children$/);
  await expect(page.getByRole('heading', { level: 1, name: '孩子成长档案' })).toBeVisible();

  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    addButton: document
      .querySelector('.children-panel > .panel-heading > button')
      ?.getBoundingClientRect().width,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);

  if (widths.viewport <= 480) {
    expect(widths.addButton).toBeGreaterThan(200);
  }

  await page.goto('/ledger');
  await expect(page.getByLabel('分类支出占比')).toBeVisible();
  await expect(page.locator('.category-chart li')).toHaveCount(2);
});

test('孕期心理自查保留旧编号，新增与编辑各自保留历史并拒绝漏答', async ({ page }) => {
  await page.goto('/pregnancy?tab=mental');
  await page.evaluate(() => {
    localStorage.setItem(
      '24years.family.v1',
      JSON.stringify({
        version: 1,
        profile: {
          name: '家庭',
          nickname: '家长',
          dueDate: '2027-06-01',
          quietMode: false,
        },
        tasks: [],
        expenses: [],
        theme: 'light',
        pregnancyRecords: [
          {
            id: 'mental-screening',
            type: 'mentalScreening',
            date: '2026-10-19',
            score: 2,
            selfHarm: false,
            answers: Array(10).fill(0),
            notes: '',
          },
          {
            id: 'screening-2026-10-26',
            type: 'mentalScreening',
            date: '2026-10-26',
            score: 3,
            selfHarm: false,
            answers: Array(10).fill(0),
            notes: '',
          },
        ],
      }),
    );
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '孕期心理状态自查' })).toBeVisible();
  await expect(page.locator('.history-list li')).toHaveCount(2);
  await page.getByRole('button', { name: /2026-10-19/ }).click();
  await expect(page.getByLabel('评估日期')).toHaveValue('2026-10-19');
  await page.getByRole('button', { name: '新建' }).click();
  await expect(page.locator('.history-list li')).toHaveCount(2);

  const answers = page.locator('.screening-questions select');
  await answers.nth(9).selectOption('0');
  await expect(answers.first()).toHaveValue('');
  await page.getByRole('button', { name: '保存心理自查' }).click();
  await expect(page.getByRole('alert')).toContainText('请完成全部题目');
  await expect(page.locator('.history-list li')).toHaveCount(2);

  await page.getByLabel('评估日期').fill('2026-10-20');

  for (let index = 0; index < 10; index += 1) {
    await answers.nth(index).selectOption('0');
  }

  await answers.first().selectOption('');
  await page.getByRole('button', { name: '保存心理自查' }).click();
  await expect(page.getByRole('alert')).toContainText('请完成全部题目');
  await expect(page.locator('.history-list li')).toHaveCount(2);

  await answers.first().selectOption('1');
  await page.getByLabel('想告诉医护人员的情况').fill('本次新建记录');
  await page.getByRole('button', { name: '保存心理自查' }).click();
  await expect(page.locator('.history-list li')).toHaveCount(3);
  await page.getByRole('button', { name: /2026-10-19/ }).click();
  await page.getByLabel('想告诉医护人员的情况').fill('旧记录已更正');
  await page.getByRole('button', { name: '保存心理自查' }).click();
  await expect(page.getByRole('status').filter({ hasText: '记录已保存' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.history-list li')).toHaveCount(3);
  await page.getByRole('button', { name: /2026-10-19/ }).click();
  await expect(page.getByLabel('想告诉医护人员的情况')).toHaveValue('旧记录已更正');
  await page.getByRole('button', { name: /2026-10-20/ }).click();
  await expect(page.getByLabel('想告诉医护人员的情况')).toHaveValue('本次新建记录');
  await expect(answers.first()).toHaveValue('1');
});
