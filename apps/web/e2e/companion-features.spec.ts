import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('胎动计数草稿刷新、纠错、编辑和零次数记录', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      errors.push(message.text());
    }
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/pregnancy?tab=movements');
  await expect(page).toHaveTitle(/24Years/);
  await expect(page.getByRole('heading', { name: '胎动观察历史' })).toBeVisible();
  await expect(page.getByRole('button', { name: '误点减一' })).toBeDisabled();
  for (let count = 0; count < 3; count += 1) {
    await page.getByRole('button', { name: '记录一次胎动 +1', exact: true }).click();
  }
  await expect(page.getByLabel('本次记录次数')).toHaveValue('3');
  await page.getByRole('button', { name: '误点减一' }).click();
  await expect(page.getByLabel('本次记录次数')).toHaveValue('2');
  await page.getByLabel('观察开始时间').fill('09:30');
  await page.getByLabel('实际观察时长（分钟）').fill('30');
  await page.getByLabel('观察备注').fill('本次观察');
  await page.reload();
  await expect(page.getByLabel('本次记录次数')).toHaveValue('2');
  await expect(page.getByLabel('观察开始时间')).toHaveValue('09:30');
  await expect(page.getByText('已恢复未提交草稿。', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '保存胎动观察', exact: true }).click();
  await expect(page.locator('.record-list')).toContainText('2 次');
  await page.reload();
  await page.locator('.record-list').getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('本次记录次数').fill('0');
  await page.reload();
  await expect(page.getByLabel('本次记录次数')).toHaveValue('0');
  await page.getByRole('button', { name: '保存胎动修改' }).click();
  await expect(page.locator('.record-list')).toContainText('0 次');
  await expect(page.locator('.record-list')).toContainText('观察时长：30 分钟');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('24years.family.v1')!).pregnancyRecords,
  );
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    type: 'movement',
    count: 0,
    minutes: 30,
    time: '09:30',
    notes: '本次观察',
  });
  await page.screenshot({
    path: join(tmpdir(), `24years-movements-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('vite-error-overlay').count()).toBe(0);
  await page.locator('.record-list').getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByText('暂无胎动观察记录。', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('体征时间场景兼容旧草稿，支持刷新、编辑和清空', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      errors.push(message.text());
    }
  });
  await page.goto('/pregnancy?tab=vitals');
  await expect(page).toHaveTitle(/24Years/);
  await page.getByLabel('体重（kg）', { exact: true }).fill('65');
  // Simulate a draft saved before these optional fields existed.
  await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((key) => key.includes('pregnancy:vital'))!;
    const saved = JSON.parse(sessionStorage.getItem(key)!);
    delete saved.form.time;
    delete saved.form.context;
    sessionStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByLabel('体重（kg）', { exact: true })).toHaveValue('65');
  await expect(page.getByLabel('测量时间（可选）')).toHaveValue('');
  await page.getByLabel('测量时间（可选）').fill('08:30');
  await page.getByLabel('测量场景（可选）').fill('晨起');
  await page.reload();
  await expect(page.getByLabel('测量时间（可选）')).toHaveValue('08:30');
  await expect(page.getByLabel('测量场景（可选）')).toHaveValue('晨起');
  await page.getByRole('button', { name: '保存体征', exact: true }).click();
  await expect(page.locator('.record-list')).toContainText('08:30');
  await page.reload();
  await page.getByText('查看趋势数据（1 条）').click();
  await expect(page.getByRole('table')).toContainText('晨起');
  await expect(page.getByRole('table')).toContainText('08:30');
  await page.screenshot({
    path: join(tmpdir(), `24years-vital-context-${testInfo.project.name}.png`),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.record-list').getByRole('button', { name: '编辑', exact: true }).click();
  await expect(page.getByLabel('测量时间（可选）')).toHaveValue('08:30');
  await page.getByLabel('测量时间（可选）').fill('');
  await page.getByLabel('测量场景（可选）').fill('');
  await page.getByRole('button', { name: '保存体征修改' }).click();
  await page.reload();
  await expect(page.locator('.record-list')).toContainText('时间未记录');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('24years.family.v1')!).pregnancyRecords,
  );
  expect(saved).toHaveLength(1);
  expect(saved[0]).not.toHaveProperty('time');
  expect(saved[0]).not.toHaveProperty('context');
  expect(await page.locator('vite-error-overlay').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('待产分工字段与编辑草稿刷新恢复，备齐费用只入账一次', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) {
      errors.push(m.text());
    }
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/pregnancy?tab=packing');
  await expect(page).toHaveTitle(/24Years/);
  await page.getByLabel('物品名称').fill('出院用品');
  await page.getByLabel('物品分类（可选）').fill('宝宝用品');
  await page.getByLabel('物品数量（可选）').fill('3');
  await page.getByLabel('负责人', { exact: true }).selectOption('single_parent');
  await page.reload();
  await expect(page.getByLabel('物品数量（可选）')).toHaveValue('3');
  await expect(page.getByText('已恢复未提交草稿。', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '保存待产清单' }).click();
  await expect(page.locator('.record-list')).toContainText('数量：3 · 负责人：本人');
  await page.locator('.record-list').getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('已经备齐').check();
  await page.getByLabel('采购金额（元，可留空）').fill('12.34');
  await page.reload();
  await expect(page.getByLabel('已经备齐')).toBeChecked();
  await expect(page.getByLabel('采购金额（元，可留空）')).toHaveValue('12.34');
  await page.getByRole('button', { name: '保存待产清单' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('24years.family.v1')!));
  expect(saved.expenses).toHaveLength(1);
  expect(saved.expenses[0].amountCents).toBe(1234);
  expect(saved.pregnancyRecords[0]).toMatchObject({
    category: '宝宝用品',
    quantity: 3,
    assignee: 'single_parent',
    completed: true,
  });
  await page.screenshot({
    path: join(tmpdir(), '24years-packing-refactor-' + testInfo.project.name + '.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('vite-error-overlay').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('孕期各类草稿恢复，不把暂存输入当成已保存记录', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  for (const [tab, label, value, save] of [
    ['checkups', '产检名称', '复诊草稿', '保存产检安排'],
    ['vitals', '体重（kg）', '62.5', '保存体征'],
    ['mood', '记录备注', '心情草稿', '保存心情日记'],
    ['bonding', '陪伴内容', '读诗草稿', '保存陪伴记录'],
    ['medical', '就诊医院', '就医卡草稿', '保存就医卡'],
  ]) {
    await page.goto('/pregnancy?tab=' + tab);
    await page.getByLabel(label!, { exact: true }).fill(value!);
    await page.reload();
    await expect(page.getByLabel(label!, { exact: true })).toHaveValue(value!);
    await expect(page.getByText('已恢复未提交草稿。', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: save!, exact: true }).click();
    await expect(page.getByText('记录已保存。', { exact: true })).toBeVisible();
    await expect(page.getByText('已恢复未提交草稿。', { exact: false })).toHaveCount(0);
  }
});

test('恢复已冲突编辑草稿时保留内容并禁止覆盖', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/pregnancy?tab=checkups');
  await page.getByLabel('产检名称').fill('预约');
  await page.getByRole('button', { name: '保存产检安排' }).click();
  await page.getByRole('button', { name: '编辑 / 完成' }).click();
  await page.getByLabel('产检备注').fill('我的未提交修改');
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('24years.family.v1')!);
    data.pregnancyRecords[0].notes = '另一处已更新';
    localStorage.setItem('24years.family.v1', JSON.stringify(data));
  });
  await page.reload();
  await expect(page.getByLabel('产检备注')).toHaveValue('我的未提交修改');
  await expect(page.getByRole('button', { name: '保存产检修改' })).toBeDisabled();
  await expect(page.getByText(/这条产检已变化/)).toBeVisible();
  await page.getByRole('button', { name: '清除草稿' }).click();
  await expect(page.getByRole('button', { name: '保存产检安排' })).toBeEnabled();
});

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
