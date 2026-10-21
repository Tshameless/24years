import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+08:00'));
  await page.addInitScript(() => {
    if (!localStorage.getItem('24years.family.v1')) {
      localStorage.setItem(
        '24years.family.v1',
        JSON.stringify({
          version: 1,
          theme: 'light',
          tasks: [],
          expenses: [],
          profile: {
            name: '每周计划测试',
            nickname: '小叶',
            dueDate: '2027-02-01',
            quietMode: false,
          },
        }),
      );
    }
  });
});

test('每周计划校验、草稿恢复、按日打卡和周期编辑', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      errors.push(message.text());
    }
  });
  await page.goto('/tasks');
  await expect(page).toHaveTitle(/24Years/);
  await expect(page.getByRole('heading', { name: '日常计划' })).toBeVisible();
  await page.getByLabel('计划名称').fill('一起整理就诊资料');
  await page.getByLabel('重复方式').selectOption('weekly');
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('至少选择一个星期');
  await page.getByRole('button', { name: '周三', exact: true }).click();
  await page.getByRole('button', { name: '周五', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel('计划名称')).toHaveValue('一起整理就诊资料');
  await expect(page.getByLabel('重复方式')).toHaveValue('weekly');
  await expect(page.getByRole('button', { name: '周三', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: '周五', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.fade-in')).toHaveCSS('opacity', '1');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.weekday-picker').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(tmpdir(), '24years-weekly-' + test.info().project.name + '.png'),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expect(page.getByText('每周 周三、周五 · 始于 2026-10-21')).toBeVisible();
  await page.getByRole('button', { name: '完成：一起整理就诊资料', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: '撤销完成：一起整理就诊资料', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '编辑计划：一起整理就诊资料' }).click();
  await page.getByLabel('重复方式').selectOption('daily');
  await page.getByRole('button', { name: '保存计划修改' }).click();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('24years.family.v1')!).tasks[0],
  );
  expect(saved.repeat).toBe('daily');
  expect(saved.weekdays).toBeUndefined();
  expect(saved.completedDates).toEqual(['2026-10-21']);
  await page.getByRole('button', { name: '撤销完成：一起整理就诊资料', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '完成：一起整理就诊资料', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('非当日计划不允许打卡，周规则上传同步后刷新保留', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByLabel('计划名称').fill('周一整理清单');
  await page.getByLabel('重复方式').selectOption('weekly');
  await page.getByRole('button', { name: '周一', exact: true }).click();
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expect(page.getByText('周一整理清单', { exact: true })).toHaveCount(0);
  await page.getByLabel('筛选计划').selectOption('all');
  await expect(
    page.getByRole('button', { name: '完成：周一整理清单', exact: true }),
  ).toBeDisabled();
  await page.getByRole('link', { name: '我的家庭', exact: true }).click();
  await page
    .getByLabel('同步账号', { exact: true })
    .fill('weekly' + crypto.randomUUID().replaceAll('-', '').slice(0, 16));
  await page.getByLabel('成员称呼').fill('每周成员');
  await page.getByLabel('账号密码').fill('weekly-test-password');
  await page.getByRole('button', { name: '注册并开启同步' }).click();
  await page.getByRole('button', { name: '上传本机档案并开启同步' }).click();
  await expect(page.getByRole('button', { name: '退出账号', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '日常计划', exact: true }).click();
  await page.reload();
  await page.getByLabel('筛选计划').selectOption('all');
  await expect(page.getByText(/每周 周一 · 始于 2026-10-21/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: '完成：周一整理清单', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '编辑计划：周一整理清单' }).click();
  await page.getByRole('button', { name: '周三', exact: true }).click();
  await page.getByRole('button', { name: '保存计划修改' }).click();
  await page.getByRole('button', { name: '完成：周一整理清单', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '撤销完成：周一整理清单', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByText('每周 周一、周三 · 始于 2026-10-21')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '撤销完成：周一整理清单', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
