import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('选择登录或本机使用，未登录备份可迁移到新浏览器', async ({ page, browser, baseURL }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '要登录后使用吗？' })).toBeVisible();
  await page.getByRole('link', { name: '登录 / 注册', exact: true }).click();
  await expect(page.getByRole('button', { name: '登录同步账号', exact: true })).toBeVisible();
  await expect(page.getByText(/数据仅保存在当前设备的当前浏览器/)).toBeVisible();
  await page.screenshot({
    path: join(tmpdir(), `24years-login-${test.info().project.name}.png`),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: '暂不登录，使用本机记录' }).click();
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('本机备份之家');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await page.goto('/backup');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出我的数据' }).click();
  const raw = await readFile((await (await event).path())!, 'utf8');
  const other = await browser.newContext({ baseURL, viewport: page.viewportSize() });

  try {
    const target = await other.newPage();
    await target.goto('/');
    await target.getByRole('link', { name: '已有备份？导入恢复' }).click();
    await target.getByText('从 JSON 备份恢复', { exact: true }).click();
    await target.getByLabel('选择 JSON 备份').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(raw),
    });
    await expect(target.getByText('本机备份之家', { exact: true })).toBeVisible();
    await expect(target.getByRole('button', { name: '确认恢复备份' })).toBeDisabled();
    await target.getByLabel('我理解恢复会替换当前记录').check();
    await target.getByRole('button', { name: '确认恢复备份' }).click();
    await expect(target.getByRole('status')).toContainText('备份已恢复');
    await target.goto('/family');
    await expect(target.getByLabel('家庭名称')).toHaveValue('本机备份之家');
    await target.reload();
    await expect(target.getByLabel('家庭名称')).toHaveValue('本机备份之家');
    await target.goto('/');
    await target.getByRole('button', { name: '暂不登录，使用本机记录' }).click();
    await target.reload();
    await expect(target.getByRole('heading', { name: '要登录后使用吗？' })).toHaveCount(0);
    expect(await target.evaluate(() => localStorage.getItem('24years.cloud.active'))).not.toBe(
      'true',
    );
  } finally {
    await other.close();
  }

  expect(errors).toEqual([]);
});
