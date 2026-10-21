import { expect, test } from '@playwright/test';

test('建档后的指引可收起恢复，真实记录推进流程，分组保留直达入口', async ({ page }) => {
  await page.goto('/family');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('新的小家');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await page.getByRole('link', { name: '回首页查看使用指引' }).click();
  const guide = page.getByRole('region', { name: '从这里开始' });
  await expect(guide).toContainText('已完成 1 / 3');
  await page.screenshot({
    path: `test-results/getting-started-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '收起指引' }).click();
  await page.reload();
  await expect(guide).toHaveCount(0);
  await page.getByRole('button', { name: '展开首次使用指引' }).click();
  await guide.getByRole('link', { name: '创建第一项计划' }).click();
  await page.getByLabel('计划名称').fill('散步十分钟');
  await page.getByRole('button', { name: '保存计划' }).click();
  await page.getByRole('link', { name: '今日陪伴', exact: true }).click();
  await expect(guide).toContainText('已完成 2 / 3');
  await guide.getByRole('link', { name: '添加产检' }).click();
  await expect(page).toHaveURL('/pregnancy?tab=checkups');
  await page.getByLabel('产检名称').fill('下一次产检');
  await page.getByRole('button', { name: '保存产检安排' }).click();
  const navigation = page.getByRole('navigation', { name: '孕期记录类型' });
  await expect(navigation.getByRole('heading')).toHaveText([
    '日常陪伴',
    '产检与健康',
    '待产与应急',
  ]);
  await expect(navigation.getByRole('link')).toHaveCount(8);
  await navigation.getByRole('link', { name: '就医卡', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('就诊医院', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/pregnancy-groups-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('link', { name: '今日陪伴', exact: true }).click();
  await expect(guide).toContainText('已完成 3 / 3');
  await page.reload();
  await expect(guide).toContainText('基础流程已完成');
});

test('收起账号管理不丢失输入，静默关怀隐藏入门指引', async ({ page }) => {
  await page.goto('/family');
  const management = page.locator('details.secondary-settings');
  await page.getByLabel('同步账号', { exact: true }).fill('draft-account');
  await management.locator(':scope > summary').click();
  await expect(page.getByLabel('同步账号', { exact: true })).toBeHidden();
  await management.locator(':scope > summary').click();
  await expect(page.getByLabel('同步账号', { exact: true })).toHaveValue('draft-account');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('安静的小家');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByLabel('静默关怀').check();
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await page.getByRole('link', { name: '今日陪伴', exact: true }).click();
  await expect(page.getByRole('heading', { name: '从这里开始' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '展开首次使用指引' })).toHaveCount(0);
});
