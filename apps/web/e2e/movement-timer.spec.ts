import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T20:00:00+08:00'));
  await page.addInitScript(() => {
    if (!localStorage.getItem('24years.family.v2')) {
      localStorage.setItem(
        '24years.family.v2',
        JSON.stringify({
          version: 2,
          theme: 'light',
          tasks: [],
          expenses: [],
          pregnancyRecords: [],
          children: [],
          profile: {
            name: '计时验收',
            nickname: '小叶',
            dueDate: '2027-02-01',
            quietMode: false,
            familyMode: 'single',
            parentRole: 'single_parent',
          },
        }),
      );
    }
  });
});

test('计时刷新恢复、到时补算、确认后手动保存', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await page.goto('/pregnancy?tab=movements');
  await expect(page.getByRole('heading', { name: '胎动观察历史' })).toBeVisible();
  await page.screenshot({
    path: join(tmpdir(), `24years-timer-initial-${testInfo.project.name}.png`),
    animations: 'disabled',
  });
  await page.getByLabel('设定观察时长（分钟）').fill('1');
  await page.getByRole('button', { name: '开始观察计时', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveText('01:00');
  await expect(page.getByRole('button', { name: '保存胎动观察', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '记录一次胎动 +1', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('timer')).toHaveText('01:00');
  await expect(page.getByLabel('本次记录次数')).toHaveValue('1');
  await page.clock.setFixedTime(new Date('2026-10-21T20:05:00+08:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('观察计时已结束', { exact: true })).toBeVisible();
  await expect(page.getByLabel('实际观察时长（分钟）')).toHaveValue('1');
  const records = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('24years.family.v2')!).pregnancyRecords);
  expect(await records()).toHaveLength(0);
  await page.locator('.observation-timer').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(tmpdir(), `24years-timer-ended-${testInfo.project.name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  await page.reload();
  await expect(page.getByText('观察计时已结束', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '保存胎动观察', exact: true }).click();
  await expect(page.locator('.record-list')).toContainText('1 次');
  expect(await records()).toEqual([
    expect.objectContaining({ type: 'movement', minutes: 1, count: 1, time: '20:00' }),
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('vite-error-overlay').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('静默模式保留站内结果，提前结束可保存零次记录', async ({ page }) => {
  await page.addInitScript(() => {
    const data = JSON.parse(localStorage.getItem('24years.family.v2')!);
    data.profile.quietMode = true;
    localStorage.setItem('24years.family.v2', JSON.stringify(data));
  });
  await page.goto('/pregnancy?tab=movements');
  await expect(page.getByRole('button', { name: '开启计时提示音与振动' })).toBeDisabled();
  await page.getByRole('button', { name: '开始观察计时', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-10-21T20:01:01+08:00'));
  await page.getByRole('button', { name: '提前结束计时', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByText('观察计时已结束', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('实际观察时长（分钟）')).toHaveValue('2');
  await page.getByRole('button', { name: '保存胎动观察', exact: true }).click();
  await expect(page.locator('.record-list')).toContainText('0 次');
});

test('系统通知须主动授权，到时去重，发送失败保留站内提示', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = { requests: 0, titles: [] as string[], fail: false };
    Object.assign(window, { timerNotificationProbe: probe });
    class MockNotification {
      static permission = 'default';
      static async requestPermission() {
        probe.requests++;
        this.permission = 'granted';

        return 'granted';
      }
      constructor(title: string) {
        if (probe.fail) {
          throw new Error('Unsupported notification');
        }

        probe.titles.push(title);
      }
      close() {}
    }
    Object.defineProperty(window, 'Notification', { configurable: true, value: MockNotification });
  });
  await page.goto('/pregnancy?tab=movements');
  const probe = () =>
    page.evaluate(
      () =>
        (window as unknown as { timerNotificationProbe: { requests: number; titles: string[] } })
          .timerNotificationProbe,
    );
  expect((await probe()).requests).toBe(0);
  await page.getByRole('button', { name: '开启计时系统通知', exact: true }).click();
  await page.getByLabel('设定观察时长（分钟）').fill('1');
  await page.getByRole('button', { name: '开始观察计时', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-10-21T20:01:00+08:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(async () => (await probe()).titles).toEqual(['24Years 观察计时结束']);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect((await probe()).titles).toHaveLength(1);
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '开始观察计时', exact: true }).click();
  await page.evaluate(() => {
    (
      window as unknown as { timerNotificationProbe: { fail: boolean } }
    ).timerNotificationProbe.fail = true;
  });
  await page.clock.setFixedTime(new Date('2026-10-21T20:02:00+08:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('观察计时已结束', { exact: true })).toBeVisible();
  await expect(
    page.getByText('此浏览器不支持当前通知方式，已保留站内提醒。', { exact: true }),
  ).toBeVisible();
});
