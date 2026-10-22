import { expect, test, type Page } from '@playwright/test';

async function createProfile(page: Page) {
  await page.goto('/family');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('完整旅程');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('38');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByText('家庭档案已保存', { exact: true })).toBeVisible();
}

test('完整周期：分娩计划草稿、打印、出生归档、产后交接与历史保护', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createProfile(page);
  await page.goto('/pregnancy?tab=birth-plan');
  await page.getByLabel('希望的陪同者（可留空）').fill('家人');
  await page.getByLabel('镇痛与舒适支持', { exact: true }).check();
  await page.getByLabel('想提前提出的问题').fill('请介绍适用的镇痛方式');
  await page.reload();
  await expect(page.getByLabel('想提前提出的问题')).toHaveValue('请介绍适用的镇痛方式');
  await page.getByRole('button', { name: '保存沟通计划', exact: true }).click();
  await expect(page.locator('.plan-summary')).toContainText('家人');
  await page.getByLabel('希望的陪同者（可留空）').fill('未提交');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '取消编辑' }).click();
  await expect(page.getByLabel('希望的陪同者（可留空）')).toHaveValue('家人');
  await expect(page.getByRole('button', { name: '保存计划修改' })).toBeEnabled();
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = 'true';
    };
  });
  await page.getByRole('button', { name: '打印 / 另存为 PDF' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-printed', 'true');
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({
    path: `test-results/birth-plan-print-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.emulateMedia({ media: 'screen' });
  await page.goto('/pregnancy?tab=outcome');
  await page.getByLabel('实际结束日期').fill('2026-01-01');
  await page.getByLabel('出生体重（克）').fill('3200');
  await page.getByLabel('宝宝称呼（可留空）').fill('小芽');
  await page.reload();
  await expect(page.getByLabel('出生体重（克）')).toHaveValue('3200');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '确认结束孕期' }).click();
  await expect(page.getByRole('button', { name: '保存结束记录修改' })).toBeEnabled();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /产后第 \d+ 天/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '下一次产检' })).toHaveCount(0);
  await page.getByRole('link', { name: '查看产后交接', exact: true }).click();
  await page.getByLabel('交接日期', { exact: true }).fill('2026-01-02');
  await page.getByLabel('产后复诊日期（按医嘱）').fill('2026-02-01');
  await page.getByLabel('新生儿随访日期（按医嘱）').fill('2026-01-10');
  await page.getByLabel('恢复与休息安排').fill('家人轮班，保留休息时间');
  await page.getByRole('button', { name: '保存产后交接' }).click();
  await expect(page.getByRole('status').filter({ hasText: '记录已保存' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('恢复与休息安排')).toHaveValue('家人轮班，保留休息时间');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/postpartum-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto('/pregnancy?tab=checkups');
  await expect(page.getByRole('button', { name: '保存产检安排' })).toBeDisabled();
  await page.goto('/pregnancy?tab=outcome');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '撤销结束记录' }).click();
  await expect(page.locator('.form-error')).toContainText('先在产后交接');
  await page.goto('/family');
  await expect(page.getByLabel('孕周（周）')).toHaveCount(0);
  await page.getByLabel('家庭名称').fill('产后的小家');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByText('家庭档案已保存', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('产后复诊：2026-02-01')).toBeVisible();
  expect(errors).toEqual([]);
});
test('其他结束进入静默关怀，撤销误操作保留历史与关怀选择', async ({ page }) => {
  await createProfile(page);
  await page.goto('/pregnancy?tab=outcome');
  await page.getByLabel('结束方式', { exact: true }).selectOption('ended');
  await page.getByLabel('实际结束日期').fill('2026-01-01');
  await expect(page.getByLabel('出生体重（克）')).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '确认结束孕期' }).click();
  await expect(page.getByRole('button', { name: '保存结束记录修改' })).toBeEnabled();
  await page.goto('/');
  await expect(page.getByText('静默关怀已开启', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /产后第/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '今日的小计划' })).toHaveCount(0);
  await page.goto('/pregnancy?tab=outcome');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '撤销结束记录' }).click();
  await expect(page.getByRole('button', { name: '确认结束孕期' })).toBeEnabled();
  await page.goto('/pregnancy?tab=checkups');
  await expect(page.getByRole('button', { name: '保存产检安排' })).toBeEnabled();
  await page.goto('/family');
  await expect(page.getByLabel('静默关怀')).toBeChecked();
});

test('共享全周期：干净表单跟随更新，冲突草稿保留，归档和只读角色同步', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ baseURL, viewport: page.viewportSize() });
  const partner = await context.newPage();
  const register = async (target: Page) => {
    await target.goto('/family');
    await target
      .getByLabel('同步账号', { exact: true })
      .fill(`cycle${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`);
    await target.getByLabel('成员称呼').fill('家人');
    await target.getByLabel('账号密码').fill('family-test-password');
    await target.getByRole('button', { name: '注册并开启同步' }).click();
    await expect(target.getByRole('heading', { name: '我的同步账号' })).toBeVisible();
  };

  try {
    await register(page);
    await page.getByRole('radio', { name: '多人', exact: true }).check();
    await page.getByRole('radio', { name: '母亲', exact: true }).first().check();
    await page.getByLabel('家庭名称').fill('共享全周期');
    await page.getByLabel('怎么称呼你').fill('小叶');
    await page.getByLabel('孕周（周）').fill('38');
    await page.getByRole('button', { name: '保存家庭档案' }).click();
    await page.getByRole('button', { name: '生成邀请码', exact: true }).click();
    const code = (await page.getByTestId('invite-code').innerText()).trim();
    await register(partner);
    await partner.getByRole('radio', { name: '父亲', exact: true }).check();
    await partner.getByLabel('伴侣邀请码').fill(code);
    partner.once('dialog', (dialog) => dialog.accept());
    await partner.getByRole('button', { name: '加入伴侣家庭' }).click();
    await expect(partner.getByText('2 / 2 位成员')).toBeVisible();
    await page.goto('/pregnancy?tab=birth-plan');
    await partner.goto('/pregnancy?tab=birth-plan');
    await page.getByLabel('想提前提出的问题').fill('第一版问题');
    await page.getByRole('button', { name: '保存沟通计划', exact: true }).click();
    await expect(partner.getByLabel('想提前提出的问题')).toHaveValue('第一版问题');
    await partner.getByLabel('想提前提出的问题').fill('保留我的修改');
    await page.getByLabel('想提前提出的问题').fill('已保存的第二版');
    await page.getByRole('button', { name: '保存计划修改' }).click();
    await expect(partner.getByRole('button', { name: '保存计划修改' })).toBeDisabled();
    await expect(partner.getByLabel('想提前提出的问题')).toHaveValue('保留我的修改');
    partner.once('dialog', (dialog) => dialog.accept());
    await partner.getByRole('button', { name: '清除草稿', exact: true }).click();
    await expect(partner.getByLabel('想提前提出的问题')).toHaveValue('已保存的第二版');
    await page.goto('/pregnancy?tab=outcome');
    await page.getByLabel('实际结束日期').fill('2026-01-01');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '确认结束孕期' }).click();
    await expect(partner.getByRole('button', { name: '保存计划修改' })).toBeDisabled();
    await partner.goto('/pregnancy');
    await expect(partner.getByRole('heading', { name: '产后交接', exact: true })).toBeVisible();
    await partner.getByLabel('照护支持与联系人').fill('轮班照护');
    await partner.getByRole('button', { name: '保存产后交接' }).click();
    await page.goto('/pregnancy?tab=postpartum');
    await expect(page.getByLabel('照护支持与联系人')).toHaveValue('轮班照护');
    await page.goto('/family');
    await page.getByLabel('家人的权限').selectOption('viewer');
    await expect(partner.getByRole('button', { name: '保存产后交接' })).toBeDisabled();
    await partner.goto('/pregnancy?tab=outcome');
    await expect(partner.getByRole('button', { name: '保存结束记录修改' })).toBeDisabled();
    await expect(partner.getByRole('button', { name: '撤销结束记录' })).toBeDisabled();
  } finally {
    await context.close();
  }
});
