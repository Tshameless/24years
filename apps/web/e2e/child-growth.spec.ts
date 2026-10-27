import { expect, test, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function dateOffset(page: Page, days: number) {
  return page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }, days);
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);

  return result.toISOString().slice(0, 10);
}

async function createFamily(page: Page) {
  await page.goto('/family');
  await page.getByRole('radio', { name: '单人', exact: true }).check();
  await page.getByLabel('家庭名称').fill('成长记录测试家庭');
  await page.getByLabel('怎么称呼你').fill('小叶');
  await page.getByLabel('孕周（周）').fill('24');
  await page.getByRole('button', { name: '保存家庭档案' }).click();
  await expect(page.getByText('家庭档案已保存', { exact: true })).toBeVisible();
}

test('儿童成长记录只显示家庭数据，可按医嘱创建提醒', async ({ page }) => {
  await createFamily(page);
  const birthDate = await dateOffset(page, -440);
  await page.getByRole('button', { name: '添加孩子档案' }).click();
  await page.getByLabel('孩子姓名或昵称 *').fill('小芽');
  await page.getByLabel('出生日期 *').fill(birthDate);
  await page.getByLabel('出生孕周（周，可选）').fill('32');
  await page.getByRole('button', { name: '确认添加' }).click();

  const tracker = page.locator('.growth-tracker');
  await page.getByRole('button', { name: '生长发育记录' }).click();
  await expect(tracker).toContainText('不提供生长标准评估或接种建议');
  await expect(tracker).toContainText(/早产儿矫正月龄约 \d+ 个月/);
  await expect(tracker).not.toContainText('国家免疫规划');

  await page.getByRole('button', { name: '记录生长数据' }).click();
  const measurementDate = page.getByLabel('测量日期');
  const today = await measurementDate.getAttribute('max');
  await expect(measurementDate).toHaveAttribute('min', birthDate);
  await measurementDate.fill(addDays(birthDate, -1));
  await page.getByLabel('体重（kg）').fill('3.25');
  await page.getByRole('button', { name: '保存测量记录' }).click();
  await expect(measurementDate).toBeVisible();

  await measurementDate.fill(addDays(birthDate, 31));
  await page.getByRole('button', { name: '保存测量记录' }).click();
  await expect(page.getByRole('button', { name: '记录生长数据' })).toBeVisible();
  await expect(tracker.locator('.chart-labels')).toContainText('最新测量：3.25');

  await page.getByRole('button', { name: '记录生长数据' }).click();
  await measurementDate.fill(addDays(birthDate, 92));
  await page.getByLabel('身长（cm）').fill('65.2');
  await page.getByRole('button', { name: '保存测量记录' }).click();
  await tracker.getByRole('button', { name: '身长', exact: true }).click();
  await expect(tracker.locator('.chart-labels')).toContainText('最新测量：65.2');
  await tracker.getByRole('button', { name: '体重', exact: true }).click();
  await expect(tracker.locator('.chart-labels')).toContainText('最新测量：3.25');

  await page.getByRole('button', { name: '记录生长数据' }).click();
  await measurementDate.fill(today!);
  await page.getByLabel('体重（kg）').fill('8.3');
  await page.getByRole('button', { name: '保存测量记录' }).click();
  await expect(tracker.locator('.chart-labels')).toContainText('最新测量：8.3');
  await expect(tracker.locator('.chart-labels span').last()).toHaveText('15 月龄');

  await tracker.getByLabel('提醒内容').fill('按医嘱复诊');
  await tracker.getByLabel('日期', { exact: true }).fill(today!);
  await tracker.getByLabel('时间').fill('10:30');
  await tracker.getByRole('button', { name: '添加到计划' }).click();
  await expect(tracker.getByRole('status')).toContainText('已添加「小芽：按医嘱复诊」');
  await page.screenshot({
    path: join(tmpdir(), `24years-child-growth-${test.info().project.name}.png`),
    fullPage: true,
  });

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('儿童表单草稿恢复并阻止覆盖已变化的档案', async ({ page }) => {
  await createFamily(page);
  const birthDate = await dateOffset(page, -100);
  await page.getByRole('button', { name: '添加孩子档案' }).click();
  await page.getByLabel('孩子姓名或昵称 *').fill('小芽');
  await page.getByLabel('出生日期 *').fill(birthDate);
  await page.getByRole('button', { name: '确认添加' }).click();

  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.getByLabel('孩子姓名或昵称 *').fill('保留的草稿名称');
  await expect(page.getByText(/未提交草稿已暂存/)).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel('孩子姓名或昵称 *')).toHaveValue('保留的草稿名称');
  await expect(modal.getByRole('button', { name: '保存修改' })).toBeEnabled();

  await page.evaluate(() => {
    const family = JSON.parse(localStorage.getItem('24years.family.v1')!);
    family.children[0].notes = '另一位成员已更新';
    localStorage.setItem('24years.family.v1', JSON.stringify(family));
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(modal.getByText('孩子档案已变化，草稿仍保留；请先核对最新资料。')).toBeVisible();
  await expect(modal.getByRole('button', { name: '保存修改' })).toBeDisabled();
});

test('生长记录编辑草稿恢复原记录 ID，并在档案变化后阻止覆盖', async ({ page }) => {
  await createFamily(page);
  const birthDate = await dateOffset(page, -440);
  const recordDate = addDays(birthDate, 400);
  await page.getByRole('button', { name: '添加孩子档案' }).click();
  await page.getByLabel('孩子姓名或昵称 *').fill('小芽');
  await page.getByLabel('出生日期 *').fill(birthDate);
  await page.getByRole('button', { name: '确认添加' }).click();

  await page.getByRole('button', { name: '生长发育记录' }).click();
  const tracker = page.locator('.growth-tracker');
  await tracker.getByRole('button', { name: '记录生长数据' }).click();
  const measurementDate = tracker.getByLabel('测量日期');
  await measurementDate.fill(recordDate);
  await tracker.getByLabel('体重（kg）').fill('8.1');
  await tracker.getByRole('button', { name: '保存测量记录' }).click();

  const editRecord = async () => {
    await tracker.locator('.history-table-wrap').evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const editButton = tracker.getByRole('button', { name: `编辑 ${recordDate} 的测量记录` });
    await editButton.evaluate((button) =>
      button.scrollIntoView({ block: 'center', inline: 'center' }),
    );

    if (test.info().project.name === 'mobile') {
      const bounds = await editButton.boundingBox();
      expect(bounds).not.toBeNull();
      await page.touchscreen.tap(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
    } else {
      await editButton.click();
    }
  };

  await editRecord();
  await tracker.getByLabel('测量备注（就医或家庭测量）').fill('保留的编辑草稿');
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();

  await page.getByRole('button', { name: '生长发育记录' }).click();
  const restoredTracker = page.locator('.growth-tracker');
  await expect(restoredTracker.getByLabel('测量备注（就医或家庭测量）')).toHaveValue(
    '保留的编辑草稿',
  );
  await expect(restoredTracker.getByRole('button', { name: '保存修改' })).toBeEnabled();
  await restoredTracker.getByRole('button', { name: '保存修改' }).click();
  await expect(restoredTracker.locator('tbody tr')).toHaveCount(1);
  await expect(restoredTracker.locator('tbody tr')).toContainText('保留的编辑草稿');

  await restoredTracker.locator('.history-table-wrap').evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  const restoredEditButton = restoredTracker.getByRole('button', {
    name: `编辑 ${recordDate} 的测量记录`,
  });
  await restoredEditButton.evaluate((button) =>
    button.scrollIntoView({ block: 'center', inline: 'center' }),
  );

  if (test.info().project.name === 'mobile') {
    const bounds = await restoredEditButton.boundingBox();
    expect(bounds).not.toBeNull();
    await page.touchscreen.tap(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  } else {
    await restoredEditButton.click();
  }

  await restoredTracker.getByLabel('测量备注（就医或家庭测量）').fill('不应覆盖远端更新');
  await page.evaluate(() => {
    const family = JSON.parse(localStorage.getItem('24years.family.v1')!);
    family.children[0].growthRecords[0].weightKg = 8.5;
    localStorage.setItem('24years.family.v1', JSON.stringify(family));
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();

  await page.getByRole('button', { name: '生长发育记录' }).click();
  const staleTracker = page.locator('.growth-tracker');
  await expect(
    staleTracker.getByText('孩子档案已变化，草稿仍保留；请先核对最新档案再继续。'),
  ).toBeVisible();
  await expect(staleTracker.getByLabel('测量备注（就医或家庭测量）')).toHaveValue(
    '不应覆盖远端更新',
  );
  await expect(staleTracker.getByRole('button', { name: '保存修改' })).toBeDisabled();
  await expect(staleTracker.locator('tbody tr')).toContainText('8.5');
});
