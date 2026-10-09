import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-09T10:00:00+08:00'));
});

test('建档先选单人或多人，多人需选择父母身份并持久保存', async ({ page }) => {
  await page.goto('/family');
  await expect(page.getByRole('radio', { name: '单人', exact: true })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: '多人', exact: true })).not.toBeChecked();
  await expect(page.getByText(/适用于未婚生育、单亲妈妈/)).toBeVisible();
  await page.getByLabel('家庭名称').fill('我们的家');
  await page.getByLabel('怎么称呼你').fill('爸爸');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('radio', { name: '多人', exact: true }).check();
  await expect(page.getByRole('radio', { name: '母亲', exact: true })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: '父亲', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('radio', { name: '父亲', exact: true }).check();
  await expect(page.getByText('请填写母亲的怀孕时期。')).toBeVisible();
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('status')).toHaveText('家庭档案已保存');
  await page.reload();
  await expect(page.getByRole('radio', { name: '多人', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: '父亲', exact: true })).toBeChecked();
  await page.screenshot({
    path: `test-results/onboarding-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await expect(page.getByRole('radio', { name: '父亲', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('status')).toHaveText('家庭档案已保存');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('24years.family.v1')!).profile,
  );
  expect(saved.familyMode).toBe('single');
  expect(saved.parentRole).toBe('single_parent');
});

test('建立家庭、每日打卡、记账与刷新恢复形成完整闭环', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('link', { name: '建立我的家庭档案' }).click();
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('小树之家');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByLabel('天数（天）').selectOption('3');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('status')).toHaveText('家庭档案已保存');
  await page.getByRole('link', { name: '今日陪伴' }).click();
  await expect(page.getByRole('heading', { name: '孕 24 周 3 天' })).toBeVisible();
  await page.getByRole('link', { name: '添加计划' }).click();
  await page.getByLabel('计划名称').fill('记录今天的心情');
  await page.getByLabel('重复方式').selectOption('daily');
  await page.getByRole('button', { name: '保存计划' }).click();
  await page.getByRole('button', { name: '完成：记录今天的心情', exact: true }).click();
  await expect(page.getByRole('button', { name: '撤销完成：记录今天的心情' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('link', { name: '家庭账本', exact: true }).click();
  await page.getByLabel('账目名称').fill('本次产检');
  await page.getByLabel('账单总额（元）').fill('100.10');
  await page.getByLabel('已报销金额（元）').fill('20.05');
  await page.getByRole('button', { name: '保存账目' }).click();
  await expect(page.getByTestId('net-cost')).toHaveText('¥80.05');
  await page.getByLabel('收支类型').selectOption('allowance');
  await page.getByLabel('账目名称').fill('生育津贴');
  await page.getByLabel('到账金额（元）').fill('50');
  await page.getByRole('button', { name: '保存账目' }).click();
  await expect(page.getByTestId('net-cost')).toHaveText('¥30.05');
  await page.reload();
  await expect(page.getByTestId('net-cost')).toHaveText('¥30.05');
  await page.getByRole('button', { name: '津贴', exact: true }).click();
  await expect(page.getByText('本次产检', { exact: true })).toHaveCount(0);
  await expect(page.getByText('生育津贴', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '今日陪伴' }).click();
  await expect(page.getByRole('button', { name: '撤销完成：记录今天的心情' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('heading', { name: '小叶，今天也要好好的' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/dashboard-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '切换夜间模式' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: `test-results/dashboard-dark-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

test('无效报销不会入账，删除账目需确认', async ({ page }) => {
  await page.goto('/ledger');
  await page.getByLabel('账目名称').fill('错误报销');
  await page.getByLabel('账单总额（元）').fill('10');
  await page.getByLabel('已报销金额（元）').fill('11');
  await page.getByRole('button', { name: '保存账目' }).click();
  await expect(page.getByRole('alert')).toHaveText('医保报销不能超过这笔账目的总额。');
  await expect(page.getByTestId('net-cost')).toHaveText('¥0.00');
  await page.getByLabel('已报销金额（元）').fill('0');
  await page.getByRole('button', { name: '保存账目' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '删除账目：错误报销' }).click();
  await expect(page.getByTestId('net-cost')).toHaveText('¥10.00');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除账目：错误报销' }).click();
  await expect(page.getByTestId('net-cost')).toHaveText('¥0.00');
});

test('静默关怀持久化隐藏首页孕周与计划，数据仍可导出', async ({ page }) => {
  await page.goto('/family');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('小树之家');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByLabel('天数（天）').selectOption('3');
  await page.getByLabel('静默关怀').check();
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出我的数据' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('24years-backup-2026-10-09.json');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) {
    chunks.push(Buffer.from(chunk));
  }
  expect(JSON.parse(Buffer.concat(chunks).toString()).profile.quietMode).toBe(true);
  await page.getByRole('link', { name: '今日陪伴' }).click();
  await expect(page).toHaveURL('/');
  await page.reload();
  await expect(page.getByText('静默关怀已开启')).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日的小计划' })).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});

test('怀孕时期必填且只接受支持范围内的整数孕周', async ({ page }) => {
  await page.goto('/family');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('小树之家');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await expect(page.getByLabel('预产期', { exact: true })).toHaveCount(0);
  const weeks = page.getByLabel('孕周（周）');

  for (const value of ['', '-1', '24.5', '43']) {
    await weeks.fill(value);
    await page.getByRole('button', { name: '保存家庭档案' }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('24years.family.v1'))).toBeNull();
  }

  await weeks.fill('24');
  await page.getByLabel('天数（天）').selectOption('3');
  await expect(page.getByText(/预计预产期：2027-01-26/)).toBeVisible();
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('status')).toHaveText('家庭档案已保存');
});

test('旧档案回填孕周，跨日保存保留日期锚点并支持修改怀孕时期', async ({ page }) => {
  await page.goto('/family');
  await page.evaluate(() => {
    localStorage.setItem(
      '24years.family.v1',
      JSON.stringify({
        version: 1,
        profile: { name: '原有家庭', nickname: '小叶', dueDate: '2027-01-26', quietMode: false },
        tasks: [],
        expenses: [],
        theme: 'light',
      }),
    );
  });
  await page.reload();
  await expect(page.getByLabel('孕周（周）')).toHaveValue('24');
  await expect(page.getByLabel('天数（天）')).toHaveValue('3');

  await page.clock.setFixedTime(new Date('2026-10-10T10:00:00+08:00'));
  await page.getByLabel('家庭名称').fill('更名后的家庭');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('status')).toHaveText('家庭档案已保存');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('24years.family.v1')!).profile.dueDate,
    ),
  ).toBe('2027-01-26');

  await page.reload();
  await expect(page.getByLabel('孕周（周）')).toHaveValue('24');
  await expect(page.getByLabel('天数（天）')).toHaveValue('4');
  await page.getByLabel('孕周（周）').fill('25');
  await page.getByLabel('天数（天）').selectOption('1');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('status')).toHaveText('家庭档案已保存');
  await page.getByRole('link', { name: '今日陪伴' }).click();
  await expect(page.getByRole('heading', { name: '孕 25 周 1 天' })).toBeVisible();
});

test('损坏存档不会被默认档案覆盖', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('24years.family.v1', '{broken'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('无法读取本地存档');
  await page.getByRole('link', { name: '我的家庭', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存家庭档案' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('24years.family.v1'))).toBe('{broken');
});

test('未知路由有返回入口，空白首页无虚构记录', async ({ page }) => {
  await page.goto('/missing-page');
  await page.getByRole('link', { name: '回到首页' }).click();
  await expect(page.getByRole('link', { name: '建立我的家庭档案' })).toBeVisible();
  await expect(page.getByText('还没有计划。可以从记录一件想做的小事开始。')).toBeVisible();
  await page.screenshot({
    path: `test-results/empty-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
});
