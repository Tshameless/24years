import { expect, test, type Page } from '@playwright/test';

const password = 'reliability-password';
const backup = {
  version: 2,
  profile: {
    name: '恢复的小家',
    nickname: '小叶',
    dueDate: '2027-01-26',
    quietMode: false,
    familyMode: 'single',
    parentRole: 'single_parent',
  },
  tasks: [
    {
      id: 'restored-task',
      title: '备份中的计划',
      date: '2026-10-09',
      time: '09:00',
      repeat: 'daily',
      completedDates: ['2026-10-09'],
    },
  ],
  expenses: [
    {
      id: 'restored-expense',
      title: '备份中的账目',
      date: '2026-10-09',
      kind: 'expense',
      category: '其他',
      amountCents: 12345,
      reimbursedCents: 100,
    },
  ],
  pregnancyRecords: [],
  children: [],
  theme: 'light',
};

async function register(page: Page) {
  const username = `r${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  await page.goto('/family');
  await page.getByLabel('同步账号', { exact: true }).fill(username);
  await page.getByLabel('成员称呼').fill('小叶');
  await page.getByLabel('账号密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '注册并开启同步' }).click();
  await expect(page.getByRole('heading', { name: '我的同步账号' })).toBeVisible();
  const recoveryKey = await page.getByLabel('本次恢复密钥', { exact: true }).inputValue();
  await page.getByRole('button', { name: '已保存，隐藏密钥' }).click();

  return { username, recoveryKey };
}

async function selectBackup(page: Page, value: unknown = backup) {
  await page.getByLabel('选择 JSON 备份').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
  });
}

test('大备份可恢复并紧凑导出，本机保留超过云端额度的数据', async ({ page }) => {
  const large = {
    ...backup,
    expenses: Array.from({ length: 6500 }, (_, i) => ({
      ...backup.expenses[0],
      id: `expense-${i}`,
    })),
  };
  const raw = JSON.stringify(large, null, 2);
  expect(Buffer.byteLength(JSON.stringify(large))).toBeGreaterThan(800000);
  await page.goto('/backup');
  await page.getByText('从 JSON 备份恢复', { exact: true }).click();
  await page.getByLabel('选择 JSON 备份').setInputFiles({
    name: 'large.json',
    mimeType: 'application/json',
    buffer: Buffer.from(raw),
  });
  await page.getByLabel('我理解恢复会替换当前记录').check();
  await page.getByRole('button', { name: '确认恢复备份' }).click();
  await expect(page.getByRole('status')).toContainText('备份已恢复');
  await expect(page.getByText(/本机数据接近或超过云端容量上限/)).not.toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出我的数据' }).click();
  const stream = await (await downloading).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) {
    chunks.push(Buffer.from(chunk));
  }
  const exported = Buffer.concat(chunks).toString();
  expect(exported).toBe(JSON.stringify(large));
  expect(JSON.parse(exported)).toEqual(large);
  await page.screenshot({
    path: `test-results/backup-capacity-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('本机恢复先预览确认，拒绝错误文件并保留损坏存档副本', async ({ page }) => {
  await page.goto('/family');
  await page.evaluate(() => localStorage.setItem('24years.family.v2', '{broken'));
  await page.reload();
  await page.getByText('从 JSON 备份恢复', { exact: true }).click();
  await selectBackup(page, { bad: true });
  await expect(page.getByText(/备份格式无效或版本不受支持/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('24years.family.v2'))).toBe('{broken');
  await selectBackup(page);
  await expect(page.getByText('1 条计划 · 1 笔账目')).toBeVisible();
  await expect(page.getByRole('button', { name: '确认恢复备份' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('24years.family.v2'))).toBe('{broken');
  await page.getByLabel('我理解恢复会替换当前记录').check();
  await page.getByRole('button', { name: '确认恢复备份' }).click();
  await expect(page.getByRole('status')).toContainText('备份已恢复');
  await expect(page.getByLabel('家庭名称')).toHaveValue('恢复的小家');
  expect(await page.evaluate(() => localStorage.getItem('24years.family.v2.before-import'))).toBe(
    '{broken',
  );
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载导入前备份' }).click();
  expect((await download).suggestedFilename()).toMatch(/before-import/);
  await page.reload();
  await expect(page.getByLabel('家庭名称')).toHaveValue('恢复的小家');
  await page.goto('/ledger');
  await expect(page.getByTestId('net-cost')).toHaveText('¥122.45');
});

test('恢复密钥找回密码、重新登录和生成密钥，注销保留本机记录', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/tasks');
  await page.getByLabel('计划名称').fill('独立本机记录');
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  const { username, recoveryKey } = await register(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '退出账号', exact: true }).click();
  await page.getByRole('button', { name: '忘记密码，使用恢复密钥' }).click();
  await page.getByLabel('要找回的账号').fill(username);
  await page.getByLabel('恢复密钥', { exact: true }).fill(recoveryKey);
  await page.getByLabel('新密码', { exact: true }).fill('new-reliability-password');
  await page.getByLabel('再次输入新密码').fill('new-reliability-password');
  await page.getByRole('button', { name: '重置密码', exact: true }).click();
  const newKey = page.getByLabel('新恢复密钥', { exact: true });
  await expect(newKey).not.toHaveValue('');
  await expect(newKey).not.toHaveValue(recoveryKey);
  const keyDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载新恢复密钥' }).click();
  const keyStream = await (await keyDownload).createReadStream();
  const keyChunks: Buffer[] = [];
  for await (const chunk of keyStream!) {
    keyChunks.push(Buffer.from(chunk));
  }
  expect(JSON.parse(Buffer.concat(keyChunks).toString())).toEqual({
    username,
    recoveryKey: await newKey.inputValue(),
  });
  await page.getByRole('button', { name: '已保存，返回登录' }).click();
  await page.getByLabel('同步账号', { exact: true }).fill(username);
  await page.getByLabel('账号密码', { exact: true }).fill('new-reliability-password');
  await page.getByRole('button', { name: '登录同步账号', exact: true }).click();
  await page.getByText('账号安全与注销', { exact: true }).click();
  await page.getByLabel('验证当前密码', { exact: true }).fill('new-reliability-password');
  await page.getByRole('button', { name: '生成新的恢复密钥' }).click();
  await expect(page.getByLabel('本次恢复密钥')).not.toHaveValue(recoveryKey);
  await page.getByRole('button', { name: '已保存，隐藏密钥' }).click();
  await page.getByRole('button', { name: '注销账号', exact: true }).click();
  await page.getByLabel('注销验证密码').fill('new-reliability-password');
  await page.getByLabel('输入账号确认注销').fill(username);
  await page.getByLabel('我已了解上述数据处理方式，确认注销').check();
  await page.screenshot({
    path: `test-results/account-security-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '永久注销账号' }).click();
  await expect(page.getByRole('heading', { name: '我的同步账号' })).toHaveCount(0);
  await page.goto('/tasks');
  await expect(page.getByText('独立本机记录', { exact: true })).toBeVisible();
});

test('同步家庭恢复保留身份，并在响应丢失后安全重试及下载导入前备份', async ({ page }) => {
  await register(page);
  await page.getByRole('radio', { name: '多人', exact: true }).check();
  await page.getByRole('radio', { name: '父亲', exact: true }).first().check();
  await page.getByLabel('家庭名称').fill('导入前的家');
  await page.getByLabel('怎么称呼你').fill('爸爸');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByText('父亲 · 管理员', { exact: true })).toBeVisible();
  await page.getByText('从 JSON 备份恢复', { exact: true }).click();
  await selectBackup(page);
  await page.getByLabel('我理解恢复会替换当前记录').check();
  await page.route(
    '**/api/family/import',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: '确认恢复备份' }).click();
  await expect(page.getByRole('alert')).toContainText('尚未确认保存');
  await page.getByRole('button', { name: '确认恢复备份' }).click();
  await expect(page.getByText(/备份已恢复；替换前的数据已保留/)).toBeVisible();
  await expect(page.getByRole('radio', { name: '多人', exact: true })).toBeChecked();
  await expect(page.getByText('父亲 · 管理员', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载导入前备份' }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) {
    chunks.push(Buffer.from(chunk));
  }
  expect(JSON.parse(Buffer.concat(chunks).toString()).profile.name).toBe('导入前的家');
  await page.screenshot({
    path: `test-results/backup-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto('/ledger');
  await expect(page.getByTestId('net-cost')).toHaveText('¥122.45');
});

test('另一设备重置密码后，旧设备清除共享内容并要求重新登录', async ({ page, browser, baseURL }) => {
  const { username, recoveryKey } = await register(page);
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('受保护的家庭');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByText('单人模式 · 按自己的节奏记录')).toBeVisible();
  const other = await browser.newContext({ baseURL });

  try {
    const second = await other.newPage();
    await second.goto('/family');
    await second.getByRole('button', { name: '忘记密码，使用恢复密钥' }).click();
    await second.getByLabel('要找回的账号').fill(username);
    await second.getByLabel('恢复密钥', { exact: true }).fill(recoveryKey);
    await second.getByLabel('新密码', { exact: true }).fill('replacement-password');
    await second.getByLabel('再次输入新密码').fill('replacement-password');
    await second.getByRole('button', { name: '重置密码', exact: true }).click();
    await expect(second.getByLabel('新恢复密钥', { exact: true })).not.toHaveValue('');
    await expect(second.getByLabel('新恢复密钥', { exact: true })).not.toHaveValue(recoveryKey);
    await expect(page.getByRole('alert')).toContainText('登录已过期或已撤销');
    await expect(page.getByLabel('家庭名称')).toHaveValue('');
    await expect(page.getByRole('button', { name: '保存家庭档案' })).toBeDisabled();
    await page.getByLabel('同步账号', { exact: true }).fill(username);
    await page.getByLabel('账号密码', { exact: true }).fill('replacement-password');
    await page.getByRole('button', { name: '登录同步账号', exact: true }).click();
    await expect(page.getByLabel('家庭名称')).toHaveValue('受保护的家庭');
  } finally {
    await other.close();
  }
});
