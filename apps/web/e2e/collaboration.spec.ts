import { expect, test, type Page } from '@playwright/test';

async function register(page: Page, nickname: string) {
  const username = `u${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  await page.goto('/family');
  await page.getByLabel('同步账号', { exact: true }).fill(username);
  await page.getByLabel('成员称呼').fill(nickname);
  await page.getByLabel('账号密码').fill('family-test-password');
  await page.getByRole('button', { name: '注册并开启同步' }).click();
  await expect(page.getByRole('heading', { name: '我的同步账号' })).toBeVisible();

  return username;
}

async function createFamily(page: Page, mode = 'couple') {
  await page.getByRole('radio', { name: mode === 'single' ? '单人' : '多人', exact: true }).check();

  if (mode === 'couple') {
    await page.getByRole('radio', { name: '母亲', exact: true }).first().check();
  }

  await page.getByLabel('家庭名称').fill('一起长大的家');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByLabel('天数（天）').selectOption('3');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('heading', { name: '一起照顾这个家' })).toBeVisible();
}

test('两个独立浏览器配对，共同编辑与权限变更实时同步', async ({ page, browser, baseURL }) => {
  test.setTimeout(60000);
  const otherContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    timezoneId: 'Asia/Shanghai',
  });
  const partner = await otherContext.newPage();

  try {
    await register(page, '小叶');
    await createFamily(page, 'single');
    await page.getByRole('radio', { name: '多人', exact: true }).check();
    await page.getByRole('radio', { name: '母亲', exact: true }).check();
    await page.getByLabel('家庭名称').fill('一起长大的家');
    await page.getByLabel('怎么称呼你').fill('小叶');
    await page.getByLabel('孕周（周）').fill('24');
    await page.getByLabel('天数（天）').selectOption('3');
    await page.getByRole('button', { name: '保存家庭档案' }).click();
    await expect(page.getByText('家庭档案已保存', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '生成邀请码', exact: true }).click();
    const code = (await page.getByTestId('invite-code').innerText()).trim();
    await expect(page.getByLabel('配对链接')).toHaveValue(`${baseURL}/family?invite=${code}`);
    await register(partner, '小树');
    await partner.goto(`/family?invite=${code}`);
    await expect(partner.getByLabel('伴侣邀请码')).toHaveValue(code);
    await partner.getByRole('radio', { name: '父亲', exact: true }).check();
    partner.once('dialog', (dialog) => dialog.accept());
    await partner.getByRole('button', { name: '加入伴侣家庭' }).click();
    await expect(partner.getByText('2 / 2 位成员')).toBeVisible();
    await expect(page.getByText('2 / 2 位成员')).toBeVisible();
    await expect(page.getByText('母亲 · 管理员', { exact: true })).toBeVisible();
    await expect(partner.getByText('父亲 · 共同编辑', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: '单人', exact: true })).toBeDisabled();
    await expect(partner.getByLabel('家庭名称')).toHaveValue('一起长大的家');
    await expect(partner.getByRole('button', { name: '保存家庭档案' })).toBeDisabled();
    await page.screenshot({
      path: `test-results/collaboration-${test.info().project.name}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    await page.goto('/tasks');
    await page.getByLabel('计划名称').fill('一起散步');
    await page.getByRole('button', { name: '保存计划', exact: true }).click();
    await partner.goto('/tasks');
    await partner.getByRole('button', { name: '编辑计划：一起散步' }).click();
    await partner.getByLabel('计划名称').fill('晚饭后散步');
    await partner.getByRole('button', { name: '保存计划修改' }).click();
    await expect(page.getByText('晚饭后散步', { exact: true })).toBeVisible();
    await partner.getByRole('button', { name: '完成：晚饭后散步', exact: true }).click();
    await expect(page.getByRole('button', { name: '撤销完成：晚饭后散步' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.goto('/ledger');
    await page.getByLabel('账目名称').fill('共同采购');
    await page.getByLabel('账单总额（元）').fill('100.10');
    await page.getByRole('button', { name: '保存账目', exact: true }).click();
    await partner.goto('/ledger');
    await partner.getByRole('button', { name: '编辑账目：共同采购' }).click();
    await partner.getByLabel('已报销金额（元）').fill('20.05');
    await partner.getByRole('button', { name: '保存账目修改' }).click();
    await expect(page.getByTestId('net-cost')).toHaveText('¥80.05');

    // An open draft is never replaced by a poll from the other member.
    await page.getByRole('button', { name: '编辑账目：共同采购' }).click();
    await page.getByLabel('账目名称').fill('我的未提交草稿');
    await partner.getByRole('button', { name: '编辑账目：共同采购' }).click();
    await partner.getByLabel('账目名称').fill('伴侣已修改');
    await partner.getByRole('button', { name: '保存账目修改' }).click();
    await expect(page.getByText(/这笔账目已被修改或删除/)).toBeVisible();
    await expect(page.getByLabel('账目名称')).toHaveValue('我的未提交草稿');
    await expect(page.getByRole('button', { name: '保存账目修改' })).toBeDisabled();
    await page.getByRole('button', { name: '取消编辑' }).click();

    await page.goto('/family');
    await page.getByLabel('小树的权限').selectOption('viewer');
    await expect(partner.getByRole('button', { name: '保存账目', exact: true })).toBeDisabled();
    await page.getByLabel('小树的权限').selectOption('editor');
    await expect(partner.getByRole('button', { name: '保存账目', exact: true })).toBeEnabled();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '解除配对' }).click();
    await expect(partner.getByText('伴侣已修改', { exact: true })).toHaveCount(0);
    await page.getByRole('radio', { name: '单人', exact: true }).check();
    await page.getByRole('button', { name: '保存家庭档案' }).click();
    await expect(page.getByText('单人模式 · 按自己的节奏记录')).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test('本机记录上传、响应丢失后安全重试，以及另一设备登录恢复', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60000);
  await page.goto('/tasks');
  await page.getByLabel('计划名称').fill('原有本机计划');
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expect(page.getByText('原有本机计划', { exact: true })).toBeVisible();
  await page.goto('/family');
  await page.getByRole('radio', { name: '多人', exact: true }).check();
  await page.getByRole('radio', { name: '父亲', exact: true }).check();
  await page.getByLabel('家庭名称').fill('爸爸建的档案');
  await page.getByLabel('怎么称呼你').fill('爸爸');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByRole('status')).toHaveText('家庭档案已保存');
  const username = await register(page, '跨端成员');
  await page.getByRole('button', { name: '上传本机档案并开启同步' }).click();
  await expect(page.getByText('父亲 · 管理员', { exact: true })).toBeVisible();
  await page.goto('/tasks');
  await expect(page.getByText('原有本机计划', { exact: true })).toBeVisible();
  await page.goto('/ledger');
  await page.getByLabel('账目名称').fill('不能重复的账单');
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
  await expect(page.getByLabel('账目名称')).toHaveValue('不能重复的账单');
  await page.getByRole('button', { name: '保存账目', exact: true }).click();
  await expect(page.getByTestId('net-cost')).toHaveText('¥42.50');
  await expect(page.getByText('不能重复的账单', { exact: true })).toHaveCount(1);
  const other = await browser.newContext({ baseURL, viewport: page.viewportSize() });

  try {
    const second = await other.newPage();
    await second.goto('/family');
    await second.getByRole('button', { name: '已有账号，去登录' }).click();
    await second.getByLabel('同步账号', { exact: true }).fill(username);
    await second.getByLabel('账号密码').fill('family-test-password');
    await second.getByRole('button', { name: '登录同步账号', exact: true }).click();
    await expect(second.getByText('1 / 2 位成员')).toBeVisible();
    await expect(second.getByText('父亲 · 管理员', { exact: true })).toBeVisible();
    await second.goto('/ledger');
    await expect(second.getByTestId('net-cost')).toHaveText('¥42.50');
    await second.reload();
    await expect(second.getByTestId('net-cost')).toHaveText('¥42.50');
    await second.goto('/tasks');
    await expect(second.getByText('原有本机计划', { exact: true })).toBeVisible();
  } finally {
    await other.close();
  }
});
