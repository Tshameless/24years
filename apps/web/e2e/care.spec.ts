import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('胎教、心情和待产记录保存并刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/family');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('陪伴之家');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await page.goto('/pregnancy?tab=bonding');
  await expect(page.getByRole('heading', { name: '胎教与声音陪伴' })).toBeVisible();
  await page.getByLabel('选择阅读内容').selectOption('2');
  await expect(page.getByText('24Years · 原创陪伴短文')).toBeVisible();
  await expect(page.getByLabel('选择本机音频')).toBeVisible();
  await page.getByLabel('陪伴内容', { exact: true }).fill('一起读小种子的晚安');
  await page.getByRole('button', { name: '保存陪伴记录' }).click();
  await page.reload();
  await expect(page.getByText('一起读小种子的晚安', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: join(tmpdir(), `24years-care-${test.info().project.name}.png`),
    fullPage: true,
  });
  await page.getByRole('link', { name: '心情日记', exact: true }).click();
  await page.getByLabel('此刻心情').selectOption('愉悦');
  await page.getByLabel('记录备注').fill('今天一起散步');
  await page.getByRole('button', { name: '保存心情日记' }).click();
  await page.reload();
  await expect(page.getByText('今天一起散步', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '待产清单', exact: true }).click();
  await page.getByLabel('物品名称').fill('病历资料袋');
  await page.getByLabel('已经备齐').check();
  await page.getByRole('button', { name: '保存待产清单' }).click();
  await page.reload();
  await expect(page.getByText('已备齐', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('已经备齐').uncheck();
  await page.getByRole('button', { name: '保存待产清单' }).click();
  await expect(page.getByText('待准备', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
