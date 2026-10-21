import { expect, test } from '@playwright/test';

for (const synced of [false, true]) {
  test(`缺少 randomUUID 时${synced ? '同步' : '本机'}计划表单仍可新增和修改`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    });
    await page.goto('/family');

    if (synced) {
      await page
        .getByLabel('同步账号', { exact: true })
        .fill(`compat${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`);
      await page.getByLabel('成员称呼').fill('测试成员');
      await page.getByLabel('账号密码').fill('compatibility-password');
      await page.getByRole('button', { name: '注册并开启同步' }).click();
      await expect(page.getByRole('heading', { name: '我的同步账号' })).toBeVisible();
    }

    await page.getByRole('radio', { name: '单人', exact: true }).check();
    await page.getByLabel('家庭名称').fill('测试家庭');
    await page.getByLabel('怎么称呼你').fill('小叶');
    await page.getByLabel('孕周（周）').fill('24');
    await page.getByRole('button', { name: '保存家庭档案' }).click();
    await expect(page.getByRole('heading', { name: '家庭档案', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('家庭名称')).toHaveValue('测试家庭');
    await page.goto('/tasks');
    await expect(page.getByLabel('计划名称')).toBeVisible();
    await page.getByLabel('计划名称').fill('饭后散步');
    await page.getByRole('button', { name: '保存计划', exact: true }).click();
    await expect(page.getByText('饭后散步', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('饭后散步', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '编辑计划：饭后散步' }).click();
    await page.getByLabel('计划名称').fill('饭后轻松散步');
    await page.getByRole('button', { name: '保存计划修改' }).click();
    await expect(page.getByText('饭后轻松散步', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
