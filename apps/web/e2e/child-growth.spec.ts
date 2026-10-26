import { expect, test, type Page } from '@playwright/test';

async function createFamily(page: Page) {
  await page.goto('/family');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('成长记录测试家庭');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByText('家庭档案已保存', { exact: true })).toBeVisible();
}

test('儿童成长记录只显示家庭数据，可按医嘱创建提醒', async ({ page }) => {
  await createFamily(page);
  await page.getByRole('button', { name: '添加孩子档案' }).click();
  await page.getByLabel('孩子姓名或昵称 *').fill('小芽');
  await page.getByLabel('出生日期 *').fill('2025-05-01');
  await page.getByRole('button', { name: '确认添加' }).click();

  const tracker = page.locator('.growth-tracker');
  await page.getByRole('button', { name: '生长发育记录' }).click();
  await expect(tracker).toContainText('不提供生长标准评估或接种建议');
  await expect(tracker).not.toContainText('国家免疫规划');

  await page.getByRole('button', { name: '记录生长数据' }).click();
  const measurementDate = page.getByLabel('测量日期');
  const today = await measurementDate.getAttribute('max');
  await expect(measurementDate).toHaveAttribute('min', '2025-05-01');
  await measurementDate.fill('2025-04-30');
  await page.getByLabel('体重（kg）').fill('3.25');
  await page.getByRole('button', { name: '保存测量记录' }).click();
  await expect(measurementDate).toBeVisible();

  await measurementDate.fill('2025-06-01');
  await page.getByRole('button', { name: '保存测量记录' }).click();
  await expect(page.getByRole('button', { name: '记录生长数据' })).toBeVisible();
  await expect(tracker.locator('.chart-labels')).toContainText('最新测量：3.25');

  await page.getByRole('button', { name: '记录生长数据' }).click();
  await measurementDate.fill('2025-08-01');
  await page.getByLabel('身长（cm）').fill('65.2');
  await page.getByRole('button', { name: '保存测量记录' }).click();
  await tracker.getByRole('button', { name: '身长', exact: true }).click();
  await expect(tracker.locator('.chart-labels')).toContainText('最新测量：65.2');
  await tracker.getByRole('button', { name: '体重', exact: true }).click();
  await expect(tracker.locator('.chart-labels')).toContainText('最新测量：3.25');

  await tracker.getByLabel('提醒内容').fill('按医嘱复诊');
  await tracker.getByLabel('日期', { exact: true }).fill(today!);
  await tracker.getByLabel('时间').fill('10:30');
  await tracker.getByRole('button', { name: '添加到计划' }).click();
  await expect(tracker.getByRole('status')).toContainText('已添加「小芽：按医嘱复诊」');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
