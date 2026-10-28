import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+08:00'));
  await page.addInitScript(() => {
    if (!localStorage.getItem('24years.family.v2')) {
      localStorage.setItem(
        '24years.family.v2',
        JSON.stringify({
          version: 2,
          profile: null,
          theme: 'light',
          tasks: [],
          pregnancyRecords: [],
          children: [],
          expenses: [
            {
              id: 'old',
              date: '2025-10-31',
              title: '去年费用',
              kind: 'expense',
              category: '产检医疗',
              amountCents: 20000,
              reimbursedCents: 0,
            },
            {
              id: 'medical',
              date: '2026-10-01',
              title: '=1+1',
              kind: 'expense',
              category: '产检医疗',
              amountCents: 10010,
              reimbursedCents: 2005,
            },
            {
              id: 'goods',
              date: '2026-10-02',
              title: '宝宝用品',
              kind: 'expense',
              category: '宝宝用品',
              amountCents: 3050,
              reimbursedCents: 0,
            },
            {
              id: 'allowance',
              date: '2026-10-03',
              title: '到账津贴',
              kind: 'allowance',
              category: '产检医疗',
              amountCents: 20000,
              reimbursedCents: 0,
            },
          ],
        }),
      );
    }
  });
});

test('月份分类汇总与 CSV 一致，支持负净支出，空筛选与重置', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      errors.push(message.text());
    }
  });
  await page.goto('/ledger');
  await expect(page).toHaveURL(/\/ledger$/);
  await expect(page).toHaveTitle(/24Years/);
  await expect(page.getByRole('heading', { name: '家庭账本', exact: true })).toBeVisible();
  const raw = await page.evaluate(() => localStorage.getItem('24years.family.v2'));
  await expect(page.getByTestId('net-cost')).toHaveText('¥110.55');
  await page.getByRole('button', { name: '本月', exact: true }).click();
  await expect(page.getByLabel('账目月份')).toHaveValue('2026-10');
  await expect(page.getByTestId('filtered-total')).toHaveText('¥130.60');
  await expect(page.getByTestId('filtered-reimbursed')).toHaveText('¥20.05');
  await expect(page.getByTestId('filtered-allowance')).toHaveText('¥200.00');
  await expect(page.getByTestId('filtered-net')).toHaveText('-¥89.45');
  await expect(page.getByText('去年费用', { exact: true })).toHaveCount(0);
  await expect(page.locator('.fade-in')).toHaveCSS('opacity', '1');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('region', { name: '筛选账目汇总' }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(tmpdir(), '24years-ledger-' + test.info().project.name + '.png'),
    animations: 'disabled',
  });

  await page.getByRole('button', { name: '产检医疗', exact: true }).click();
  await expect(page.getByTestId('filtered-net')).toHaveText('¥80.05');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '导出当前筛选 CSV' }).click();
  await expect(page.getByText(/已发起 CSV 下载/)).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出当前筛选 CSV' }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('24years-ledger-2026-10-产检医疗.csv');
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('"\'=1+1"');
  expect(csv).toContain('100.10,20.05,0.00,80.05');
  expect(csv).not.toContain('去年费用');
  expect(csv.split('\r\n')).toHaveLength(3);
  await page.getByRole('button', { name: '津贴', exact: true }).click();
  await expect(page.getByTestId('filtered-net')).toHaveText('-¥200.00');
  await page.getByLabel('账目月份').fill('2026-09');
  await expect(page.getByTestId('filtered-net')).toHaveText('¥0.00');
  await expect(page.getByRole('button', { name: '导出当前筛选 CSV' })).toBeDisabled();
  await expect(page.getByText(/当前筛选没有账目/)).toBeVisible();
  await page.getByRole('button', { name: '重置筛选' }).click();
  await expect(page.getByTestId('filtered-net')).toHaveText('¥110.55');
  await expect(page.getByTestId('net-cost')).toHaveText('¥110.55');
  expect(await page.evaluate(() => localStorage.getItem('24years.family.v2'))).toBe(raw);
  expect(errors).toEqual([]);
});

test('切换月份保留未提交草稿，已保存修改立即更新筛选汇总', async ({ page }) => {
  await page.goto('/ledger');
  await page.getByLabel('账目名称').fill('尚未提交');
  await page.getByLabel('账单总额（元）').fill('10');
  await page.getByRole('button', { name: '本月', exact: true }).click();
  await expect(page.getByLabel('账目名称')).toHaveValue('尚未提交');
  await expect(page.getByTestId('filtered-total')).toHaveText('¥130.60');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '清除草稿' }).click();
  await page.getByRole('button', { name: '编辑账目：=1+1', exact: true }).click();
  await page.getByLabel('账单总额（元）').fill('110.10');
  await page.getByRole('button', { name: '保存账目修改' }).click();
  await expect(page.getByTestId('filtered-total')).toHaveText('¥140.60');
  await expect(page.getByTestId('net-cost')).toHaveText('¥120.55');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除账目：=1+1', exact: true }).click();
  await expect(page.getByTestId('filtered-total')).toHaveText('¥30.50');
  await expect(page.getByTestId('filtered-reimbursed')).toHaveText('¥0.00');
});
