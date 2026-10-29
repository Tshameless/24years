import { expect, test, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

async function createLocalProfile(page: Page, name = '产后记录家庭') {
  await page.goto('/family');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill(name);
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByText('家庭档案已保存', { exact: true })).toBeVisible();
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);

  return result.toISOString().slice(0, 10);
}

test('孕期记录双端同步，草稿冲突保留输入，只读成员不能修改', async ({ page, browser, baseURL }) => {
  test.setTimeout(60000);
  const otherContext = await browser.newContext({ baseURL, viewport: page.viewportSize() });
  const partner = await otherContext.newPage();
  const register = async (target: Page, nickname: string) => {
    await target.goto('/family');
    await target
      .getByLabel('同步账号', { exact: true })
      .fill(`p${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`);
    await target.getByLabel('成员称呼').fill(nickname);
    await target.getByLabel('账号密码').fill('family-test-password');
    await target.getByRole('button', { name: '注册并开启同步' }).click();
    await expect(target.getByRole('heading', { name: '我的同步账号' })).toBeVisible();
  };

  try {
    await register(page, '小叶');
    await page.getByRole('radio', { name: '多人', exact: true }).check();
    await page.getByRole('radio', { name: '母亲', exact: true }).first().check();
    await page.getByLabel('家庭名称').fill('共享孕期');
    await page.getByLabel('怎么称呼你').fill('小叶');
    await page.getByLabel('孕周（周）').fill('24');
    await page.getByRole('button', { name: '保存家庭档案' }).click();
    await page.getByRole('button', { name: '生成邀请码', exact: true }).click();
    const code = (await page.getByTestId('invite-code').innerText()).trim();
    await register(partner, '小树');
    await partner.getByRole('radio', { name: '父亲', exact: true }).check();
    await partner.getByLabel('伴侣邀请码').fill(code);
    partner.once('dialog', (dialog) => dialog.accept());
    await partner.getByRole('button', { name: '加入伴侣家庭' }).click();
    await expect(partner.getByText('2 / 2 位成员')).toBeVisible();
    await page.goto('/pregnancy');
    await page.getByLabel('产检名称').fill('双端产检');
    await page.getByRole('button', { name: '保存产检安排' }).click();
    await partner.goto('/pregnancy');
    await expect(partner.getByText('双端产检', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '编辑 / 完成' }).click();
    await page.getByLabel('产检备注').fill('保留我的草稿');
    await partner.getByRole('button', { name: '编辑 / 完成' }).click();
    await partner.getByLabel('产检备注').fill('另一位成员已修改');
    await partner.getByRole('button', { name: '保存产检修改' }).click();
    await expect(page.getByText(/这条产检已变化/)).toBeVisible();
    await expect(page.getByLabel('产检备注')).toHaveValue('保留我的草稿');
    await expect(page.getByRole('button', { name: '保存产检修改' })).toBeDisabled();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('link', { name: '胎动记录', exact: true }).click();
    await page.getByLabel('观察开始时间').fill('09:30');
    await page.getByLabel('实际观察时长（分钟）').fill('30');
    await page.getByRole('button', { name: '记录一次胎动 +1', exact: true }).click();
    await page.getByRole('button', { name: '保存胎动观察' }).click();
    await partner.getByRole('link', { name: '胎动记录', exact: true }).click();
    await expect(partner.locator('.record-list')).toContainText('1 次');
    await page.locator('.record-list').getByRole('button', { name: '编辑', exact: true }).click();
    await page.getByLabel('观察备注').fill('未提交修改');
    await partner
      .locator('.record-list')
      .getByRole('button', { name: '编辑', exact: true })
      .click();
    await partner.getByLabel('本次记录次数').fill('2');
    await partner.getByRole('button', { name: '保存胎动修改' }).click();
    await expect(page.getByRole('button', { name: '保存胎动修改' })).toBeDisabled();
    await expect(page.getByLabel('观察备注')).toHaveValue('未提交修改');
    page.once('dialog', (dialog) => dialog.accept());
    await page.goto('/family');
    await page.getByLabel('小树的权限').selectOption('viewer');
    await expect(partner.getByRole('button', { name: '保存胎动观察' })).toBeDisabled();
    await expect(
      partner.getByRole('button', { name: '记录一次胎动 +1', exact: true }),
    ).toBeDisabled();
    await partner
      .getByLabel('孕期记录类型')
      .getByRole('link', { name: '产检安排', exact: true })
      .click();
    await expect(partner.getByRole('button', { name: '保存产检安排' })).toBeDisabled();
    await partner.getByRole('link', { name: '就医卡', exact: true }).click();
    await expect(partner.getByRole('button', { name: '保存就医卡' })).toBeDisabled();
    await partner.getByRole('link', { name: '宫缩计时', exact: true }).click();
    await expect(partner.getByRole('button', { name: '开始本次宫缩' })).toBeDisabled();
  } finally {
    await otherContext.close();
  }
});

test('产检参考时间轴跟踪进度并可从节点创建提醒', async ({ page }) => {
  await createLocalProfile(page, '产检时间轴家庭');
  await page.goto('/pregnancy?tab=checkups');

  const item = page.locator('.schedule-list li').filter({ hasText: '糖耐量与血常规' });

  await expect(item).toContainText('即将到期');
  await item.getByRole('button', { name: '加入安排' }).click();
  await expect(page.getByLabel('产检名称')).toHaveValue('糖耐量与血常规');
  await page.getByRole('button', { name: '保存产检安排' }).click();
  await expect(item).toContainText('已加入安排');

  await item.getByRole('button', { name: '加入提醒' }).click();
  await expect(
    page.getByText('已加入就诊提醒，并在前一晚加入准备提醒。', { exact: true }),
  ).toBeVisible();

  await page
    .locator('.record-list li')
    .filter({ hasText: '糖耐量与血常规' })
    .getByRole('button', { name: '编辑 / 完成' })
    .click();
  await page.getByLabel('本次产检已完成').check();
  await page.getByRole('button', { name: '保存产检修改' }).click();
  await expect(item).toContainText('已完成');
});

test('孕期闭环：产检原子入账、体征、计时、就医卡和备份恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto('/family');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('小树之家');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await page.getByRole('link', { name: '孕期记录', exact: true }).click();
  await page.getByLabel('产检名称').fill('常规检查');
  await page.getByLabel('产检备注').fill('带好上次检查报告');
  await page.getByRole('button', { name: '保存产检安排' }).click();
  await expect(page.getByText('待产检', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑 / 完成' }).click();
  await page.getByLabel('本次产检已完成').check();
  await page.getByLabel('本次费用（元，可留空）').fill('100.10');
  await page.getByLabel('本次已报销（元）').fill('20.05');
  await page.getByRole('button', { name: '保存产检修改' }).click();
  await expect(page.getByText('已完成', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '家庭账本', exact: true }).click();
  await expect(page.getByTestId('net-cost')).toHaveText('¥80.05');
  await page.getByRole('link', { name: '孕期记录', exact: true }).click();
  await page
    .getByLabel('孕期记录类型')
    .getByRole('link', { name: '体征记录', exact: true })
    .click();
  await page.getByLabel('体重（kg）', { exact: true }).fill('62.5');
  await page.getByRole('button', { name: '保存体征', exact: true }).click();
  await expect(page.locator('.record-list').getByText('62.5', { exact: true })).toBeVisible();
  await page.getByLabel('记录项目').selectOption('bloodPressure');
  await page.getByLabel('收缩压（mmHg）').fill('150');
  await page.getByLabel('舒张压（mmHg）').fill('100');
  await page.getByRole('button', { name: '保存体征', exact: true }).click();
  await expect(page.locator('.record-list')).toContainText('原始记录');
  await expect(page.locator('.record-list')).not.toContainText(/警戒|偏高|标准区间/);
  await page.getByRole('link', { name: '宫缩计时', exact: true }).click();
  await page.getByRole('button', { name: '开始本次宫缩' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '结束本次宫缩' })).toBeVisible();
  await page.getByRole('button', { name: '结束本次宫缩' }).click();
  await expect(page.getByRole('button', { name: '开始本次宫缩' })).toBeVisible();
  await page.getByRole('link', { name: '就医卡', exact: true }).click();
  await page.getByLabel('就诊医院', { exact: true }).fill('市妇幼保健院');
  await page.getByLabel('紧急联系人', { exact: true }).fill('家人');
  await page.getByLabel('联系电话', { exact: true }).fill('13800000000');
  await page.getByLabel('过敏史、用药与其他备注', { exact: true }).fill('请出示原始病历');
  await page.getByRole('button', { name: '保存就医卡' }).click();
  await expect(page.getByRole('link', { name: '13800000000' })).toHaveAttribute(
    'href',
    'tel:13800000000',
  );
  await page.reload();
  await expect(page.getByRole('link', { name: '13800000000' })).toBeVisible();
  await page.getByRole('button', { name: '切换夜间模式' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: join(tmpdir(), `24years-pregnancy-medical-${test.info().project.name}.png`),
    fullPage: true,
  });
  await page.getByRole('button', { name: '切换日间模式' }).click();
  await page
    .getByLabel('孕期记录类型')
    .getByRole('link', { name: '产检安排', exact: true })
    .click();
  await page.screenshot({
    path: join(tmpdir(), `24years-pregnancy-checkups-${test.info().project.name}.png`),
    fullPage: true,
  });
  await page.getByRole('link', { name: '我的家庭', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出我的数据' }).click();
  const download = await downloadEvent;
  const raw = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(raw).pregnancyRecords).toHaveLength(5);
  // Replace with a valid current-schema archive with different records.
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('24years.family.v2')!);
    data.pregnancyRecords = [];
    data.expenses = [];
    localStorage.setItem('24years.family.v2', JSON.stringify(data));
  });
  await page.reload();
  await page.getByText('从 JSON 备份恢复', { exact: true }).click();
  await page.getByLabel('选择 JSON 备份').setInputFiles({
    name: 'pregnancy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await expect(page.getByText(/5 条孕期记录/)).toBeVisible();
  await page.getByLabel('我理解恢复会替换当前记录').check();
  await page.getByRole('button', { name: '确认恢复备份' }).click();
  await page.getByRole('link', { name: '孕期记录', exact: true }).click();
  await expect(page.getByText('已完成', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '家庭账本', exact: true }).click();
  await expect(page.getByTestId('net-cost')).toHaveText('¥80.05');
  expect(errors).toEqual([]);
});

test('更正分娩结局时取消删除会保留孩子并解除自动关联', async ({ page }) => {
  await createLocalProfile(page, '结局更正家庭');
  await page.goto('/pregnancy?tab=outcome');
  await page.getByLabel('宝宝称呼（可留空）').fill('小芽');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '确认结束孕期' }).click();
  await expect(page.locator('.child-sync-banner')).toContainText('小芽');

  await page.getByLabel('结束方式', { exact: true }).selectOption('ended');
  const dialogMessages: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogMessages.push(dialog.message());

    if (dialogMessages.length === 1) {
      await dialog.accept();
    } else {
      await dialog.dismiss();
    }
  });
  await page.getByRole('button', { name: '保存结束记录修改' }).click();
  await expect(page.getByRole('status').filter({ hasText: '记录已保存' })).toBeVisible();
  expect(dialogMessages).toHaveLength(2);

  await page.goto('/family');
  await expect(page.locator('.child-card')).toContainText('小芽');
  const children = await page.evaluate(
    () => JSON.parse(localStorage.getItem('24years.family.v2')!).children,
  );
  expect(children).toHaveLength(1);
  expect(children[0]).not.toHaveProperty('sourceOutcomeId');
});

test('产后随访可加入日常计划，心情与体征记录仍可保存', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  await createLocalProfile(page, '产后闭环家庭');
  await page.goto('/pregnancy?tab=outcome');
  const outcomeDate = await page.getByLabel('实际结束日期').inputValue();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '确认结束孕期' }).click();

  await page.goto('/pregnancy?tab=postpartum');
  const postpartumFollowup = addDays(outcomeDate, 1);
  const newbornFollowup = addDays(outcomeDate, 2);
  await page.getByLabel('产后复诊日期（按医嘱）').fill(postpartumFollowup);
  await page.getByLabel('新生儿随访日期（按医嘱）').fill(newbornFollowup);
  await page.getByRole('button', { name: '保存产后交接' }).click();
  await expect(page.getByRole('status').filter({ hasText: '记录已保存' })).toBeVisible();
  await page.getByRole('button', { name: /产后复诊加入计划/ }).click();
  await expect(page.getByRole('status').filter({ hasText: '已加入日常计划' })).toBeVisible();
  await page.getByRole('button', { name: /新生儿随访加入计划/ }).click();
  await expect(page.getByRole('button', { name: /新生儿随访已加入/ })).toBeVisible();

  await page.goto('/tasks');
  await page.getByLabel('筛选计划').selectOption('all');
  await expect(page.getByText('产后复诊（按医嘱）', { exact: true })).toBeVisible();
  await expect(page.getByText('新生儿随访（按医嘱）', { exact: true })).toBeVisible();

  await page.goto('/pregnancy?tab=mood');
  await page.getByLabel('记录备注').fill('产后心情记录');
  await page.getByRole('button', { name: '保存心情日记' }).click();
  await expect(page.getByText('产后心情记录', { exact: true })).toBeVisible();

  await page.goto('/pregnancy?tab=vitals');
  await page.getByLabel('体重（kg）', { exact: true }).fill('61.8');
  await page.getByRole('button', { name: '保存体征', exact: true }).click();
  await expect(page.locator('.record-list').getByText('61.8', { exact: true })).toBeVisible();
  await page.screenshot({
    path: join(tmpdir(), `24years-postpartum-care-${test.info().project.name}.png`),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
