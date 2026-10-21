import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('同步账目响应丢失后刷新不会重复记账，退出账号清除草稿', async ({ page }) => {
  await page.goto('/family');
  await page
    .getByLabel('同步账号', { exact: true })
    .fill(`draft${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`);
  await page.getByLabel('成员称呼').fill('草稿成员');
  await page.getByLabel('账号密码').fill('draft-test-password');
  await page.getByRole('button', { name: '注册并开启同步' }).click();
  await page.getByRole('button', { name: '上传本机档案并开启同步' }).click();
  await page.getByRole('link', { name: '家庭账本', exact: true }).click();
  await page.getByLabel('账目名称').fill('响应丢失的费用');
  await page.getByLabel('账单总额（元）').fill('42.50');
  await page.route(
    '**/api/family/records',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: '保存账目', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('尚未确认保存');
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel('账目名称')).toHaveValue('响应丢失的费用');
  await expect(page.getByTestId('net-cost')).toHaveText('¥42.50');
  await expect(page.getByRole('button', { name: '保存账目', exact: true })).toBeDisabled();
  await expect(page.getByText('响应丢失的费用', { exact: true })).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清除草稿' }).click();
  await page.getByLabel('账目名称').fill('退出前的私有草稿');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('link', { name: '我的家庭', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '退出账号', exact: true }).click();
  await expect(page.getByRole('button', { name: '注册并开启同步' })).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.startsWith('24years.draft.v1:')),
    ),
  ).toEqual([]);
  await page.getByRole('link', { name: '家庭账本', exact: true }).click();
  await expect(page.getByLabel('账目名称')).toHaveValue('');
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('24years.family.v1')) {
      localStorage.setItem(
        '24years.family.v1',
        JSON.stringify({
          version: 1,
          theme: 'light',
          tasks: [],
          expenses: [],
          profile: { name: '草稿测试', nickname: '小叶', dueDate: '2027-02-01', quietMode: false },
        }),
      );
    }
  });
});

test('计划草稿刷新恢复，拒绝离开保留页面，保存后清理', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto('/tasks');
  await expect(page).toHaveTitle(/24Years/);
  await expect(page.getByRole('heading', { name: '日常计划' })).toBeVisible();
  await page.getByLabel('计划名称').fill('带齐检查资料');
  await page.getByLabel('时间', { exact: true }).fill('10:30');
  await expect(page.getByText(/未提交草稿已暂存/)).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: '家庭账本', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4173/tasks');
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel('计划名称')).toHaveValue('带齐检查资料');
  await expect(page.getByLabel('时间', { exact: true })).toHaveValue('10:30');
  await expect(page.getByText(/已恢复未提交草稿/)).toBeVisible();
  await expect(page.locator('.fade-in')).toHaveCSS('opacity', '1');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: join(tmpdir(), `24years-draft-${test.info().project.name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expect(page.getByText('计划已保存。')).toBeVisible();
  await expect(page.getByRole('button', { name: '清除草稿' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('计划名称')).toHaveValue('');
  expect(errors).toEqual([]);
});

test('账目草稿往返恢复，清除需确认，未保存不计入净支出', async ({ page }) => {
  await page.goto('/ledger');
  await page.getByLabel('账目名称').fill('尚未核对的费用');
  await page.getByLabel('账单总额（元）').fill('123.45');
  await expect(page.getByTestId('net-cost')).toHaveText('¥0.00');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('link', { name: '日常计划', exact: true }).click();
  await page.getByRole('link', { name: '家庭账本', exact: true }).click();
  await expect(page.getByLabel('账单总额（元）')).toHaveValue('123.45');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '清除草稿' }).click();
  await expect(page.getByLabel('账目名称')).toHaveValue('尚未核对的费用');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清除草稿' }).click();
  await expect(page.getByLabel('账目名称')).toHaveValue('');
  await page.reload();
  await expect(page.getByRole('button', { name: '清除草稿' })).toHaveCount(0);
});

test('编辑草稿保留原始快照，刷新后不能覆盖已变化的账目', async ({ page }) => {
  await page.goto('/ledger');
  await page.getByLabel('账目名称').fill('产检费用');
  await page.getByLabel('账单总额（元）').fill('100');
  await page.getByRole('button', { name: '保存账目', exact: true }).click();
  await page.getByRole('button', { name: /编辑/ }).first().click();
  await page.getByLabel('账单总额（元）').fill('200');
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('24years.family.v1')!);
    data.expenses[0].amountCents = 15000;
    localStorage.setItem('24years.family.v1', JSON.stringify(data));
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: /编辑/ }).first().click();
  await expect(page.getByLabel('账单总额（元）')).toHaveValue('200');
  await expect(page.getByText(/原记录已变化/)).toBeVisible();
  await expect(page.getByRole('button', { name: '保存账目修改' })).toBeDisabled();
  await expect(page.getByTestId('net-cost')).toHaveText('¥150.00');
});
