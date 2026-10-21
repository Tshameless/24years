import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-21T20:00:00+08:00'));
  await page.addInitScript(() => {
    if (!localStorage.getItem('24years.family.v1')) {
      localStorage.setItem(
        '24years.family.v1',
        JSON.stringify({
          version: 1,
          theme: 'light',
          tasks: [],
          expenses: [],
          pregnancyRecords: [],
          profile: {
            name: '补齐功能测试',
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

test('模板分工结束日期持久化、到时提醒与完成消除', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tasks');
  await expect(page).toHaveTitle(/24Years/);
  await page.getByLabel('常用计划模板').selectOption('0');
  await page.getByRole('button', { name: '填入模板', exact: true }).click();
  await expect(page.getByLabel('计划名称')).toHaveValue('整理下次就诊的问题');
  await page.getByLabel('负责人', { exact: true }).selectOption('single_parent');
  await page.getByLabel('结束日期（可选）').fill('2026-10-22');
  await page.getByRole('button', { name: '保存计划', exact: true }).click();
  await expect(page.locator('.task-content')).toContainText('负责人：本人');
  await page.reload();
  await expect(page.locator('.task-content')).toContainText('截至 2026-10-22');
  await page.locator('.reminder-center summary').click();
  await expect(page.locator('.reminder-center')).toContainText('19:00 · 整理下次就诊的问题');
  await page.screenshot({
    path: join(tmpdir(), `24years-reminders-${testInfo.project.name}.png`),
    fullPage: true,
  });
  await page.getByRole('button', { name: '完成：整理下次就诊的问题', exact: true }).click();
  await expect(page.locator('.reminder-center summary')).toContainText('0 项');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('24years.family.v1')!).tasks[0],
  );
  expect(saved.assignee).toBe('single_parent');
  expect(saved.completedDates).toEqual(['2026-10-21']);
  expect(await page.locator('vite-error-overlay').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('待产模板保存、备齐原子入账、再次编辑不重复记账', async ({ page }) => {
  await page.goto('/pregnancy?tab=packing');
  await page.getByLabel('待产准备模板').selectOption('0');
  await page.getByRole('button', { name: '填入待产模板' }).click();
  await page.getByRole('button', { name: '保存待产清单' }).click();
  await page.locator('.record-list').getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('已经备齐').check();
  await page.getByLabel('采购金额（元，可留空）').fill('12.34');
  await page.getByRole('button', { name: '保存待产清单' }).click();
  await expect(page.locator('.record-list')).toContainText('已备齐');
  await page.reload();
  await page.locator('.record-list').getByRole('button', { name: '编辑', exact: true }).click();
  await expect(
    page.getByText('已有关联账目，金额请在家庭账本修改。删除物品不会删除账目。'),
  ).toBeVisible();
  await page.getByLabel('记录备注').fill('修改位置');
  await page.getByRole('button', { name: '保存待产清单' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('24years.family.v1')!));
  expect(saved.expenses).toHaveLength(1);
  expect(saved.expenses[0].amountCents).toBe(1234);
  expect(saved.expenses[0].category).toBe('待产准备');
  await page.goto('/ledger');
  await expect(page.getByText('证件与就诊资料袋', { exact: true })).toBeVisible();
});

test('就诊模板保持预约日期由用户确认', async ({ page }) => {
  await page.goto('/pregnancy?tab=checkups');
  await page.getByLabel('产检日期').fill('2026-10-25');
  await page.getByLabel('就诊准备模板').selectOption('1');
  await page.getByRole('button', { name: '填入就诊模板' }).click();
  await expect(page.getByLabel('产检日期')).toHaveValue('2026-10-25');
  await page.getByRole('button', { name: '保存产检安排', exact: true }).click();
  await expect(page.locator('.record-list')).toContainText('复诊与报告沟通');
});

test('通知主动授权、当前会话去重、静默模式关闭通知', async ({ page }) => {
  await page.addInitScript(() => {
    const probe = { requests: 0, bodies: [] as string[], closed: 0 };
    Object.assign(window, { notificationProbe: probe });
    class MockNotification {
      static permission = 'default';
      static async requestPermission() {
        probe.requests++;
        this.permission = 'granted';

        return 'granted';
      }
      onclose: (() => void) | null = null;
      constructor(_title: string, options: { body: string }) {
        probe.bodies.push(options.body);
      }
      close() {
        probe.closed++;
        this.onclose?.();
      }
    }
    Object.defineProperty(window, 'Notification', { configurable: true, value: MockNotification });
    const data = JSON.parse(localStorage.getItem('24years.family.v1')!);
    data.tasks = [
      {
        id: 'notify',
        title: '私密任务内容',
        date: '2026-10-21',
        time: '19:00',
        repeat: 'daily',
        completedDates: [],
      },
    ];
    localStorage.setItem('24years.family.v1', JSON.stringify(data));
  });
  await page.goto('/tasks');
  const probe = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            notificationProbe: { requests: number; bodies: string[]; closed: number };
          }
        ).notificationProbe,
    );
  expect((await probe()).requests).toBe(0);
  await page.locator('.reminder-center summary').click();
  await page.getByRole('button', { name: '开启本次页面通知' }).click();
  await expect.poll(async () => (await probe()).bodies.length).toBe(1);
  expect((await probe()).bodies[0]).not.toContain('私密');
  await page.getByRole('button', { name: '完成：私密任务内容', exact: true }).click();
  await page.getByRole('button', { name: '撤销完成：私密任务内容', exact: true }).click();
  expect((await probe()).bodies).toHaveLength(1);
  await page.getByRole('link', { name: '我的家庭', exact: true }).click();
  await page.getByLabel('静默关怀').check();
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.locator('.reminder-center')).toHaveCount(0);
  expect((await probe()).closed).toBe(1);
});

test('趋势指标日期过滤、双血压曲线和窄屏布局', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      errors.push(message.text());
    }
  });
  await page.goto('/pregnancy?tab=vitals');
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('24years.family.v1')!);
    data.pregnancyRecords = [
      {
        id: 'weight',
        type: 'vital',
        metric: 'weight',
        date: '2026-10-20',
        value: 65,
        secondary: null,
        notes: '',
      },
      {
        id: 'bp1',
        type: 'vital',
        metric: 'bloodPressure',
        date: '2026-10-20',
        value: 120,
        secondary: 80,
        notes: '早上',
      },
      {
        id: 'bp2',
        type: 'vital',
        metric: 'bloodPressure',
        date: '2026-10-21',
        value: 118,
        secondary: 78,
        notes: '晚上',
      },
    ];
    localStorage.setItem('24years.family.v1', JSON.stringify(data));
  });
  await page.reload();
  await page.getByLabel('趋势指标').selectOption('bloodPressure');
  const panel = page.getByRole('region', { name: '体征趋势', exact: true });
  await expect(panel).toContainText('共 2 条');
  await expect(panel.locator('polyline')).toHaveCount(2);
  await panel.getByText('查看趋势数据（2 条）').click();
  await expect(panel.getByRole('table')).toContainText('120 / 80');
  await page.screenshot({
    path: join(tmpdir(), `24years-vitals-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByLabel('起始日期', { exact: true }).fill('2026-10-21');
  await expect(panel).toContainText('共 1 条');
  await page.getByLabel('截止日期', { exact: true }).fill('2026-10-19');
  await expect(panel.getByRole('alert')).toContainText('不得早于');
  expect(errors).toEqual([]);
});
