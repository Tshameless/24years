import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

test('胎教、心情和待产记录保存并刷新恢复', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/family');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
  const icon = await page.request.get('/favicon.svg');
  expect(icon.ok()).toBe(true);
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
  expect(await icon.text()).toContain('viewBox="0 0 64 64"');
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
  // Generate a small PCM WAV fixture in memory, without external media or uploads.
  const wav = Buffer.alloc(44 + 16000);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(16000, 40);
  await page
    .getByLabel('选择本机音频')
    .setInputFiles({ name: 'sample.wav', mimeType: 'audio/wav', buffer: wav });
  await expect
    .poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.readyState))
    .toBeGreaterThan(0);
  await page.locator('audio').evaluate(async (el: HTMLAudioElement) => {
    await el.play();
  });
  await expect
    .poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: '移除音频' }).click();
  await expect(page.locator('audio')).toHaveCount(0);
  await page.getByLabel('陪伴内容', { exact: true }).fill('一起读小种子的晚安');
  await page.getByRole('button', { name: '保存陪伴记录' }).click();
  await page.reload();
  await expect(page.getByText('一起读小种子的晚安', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: join(tmpdir(), `24years-care-${test.info().project.name}.png`),
    fullPage: true,
    animations: 'disabled',
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
  await expect(page.locator('.record-list').getByText('已备齐', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('已经备齐').uncheck();
  await page.getByRole('button', { name: '保存待产清单' }).click();
  await expect(page.locator('.record-list').getByText('待准备', { exact: true })).toBeVisible();
  await page.goto('/backup');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出我的数据' }).click();
  const raw = await readFile((await (await downloadEvent).path())!, 'utf8');
  expect(
    JSON.parse(raw)
      .pregnancyRecords.map((item: { type: string }) => item.type)
      .sort(),
  ).toEqual(['bonding', 'mood', 'packing']);
  expect(raw).not.toContain('blob:');
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('24years.family.v2')!);
    data.pregnancyRecords = [];
    localStorage.setItem('24years.family.v2', JSON.stringify(data));
  });
  await page.reload();
  await page.getByText('从 JSON 备份恢复', { exact: true }).click();
  await page
    .getByLabel('选择 JSON 备份')
    .setInputFiles({ name: 'care.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await page.getByLabel('我理解恢复会替换当前记录').check();
  await page.getByRole('button', { name: '确认恢复备份' }).click();
  await expect(page.getByRole('status')).toContainText('备份已恢复');
  await page.goto('/pregnancy?tab=bonding');
  await expect(page.getByText('一起读小种子的晚安', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
