import { mount } from '@vue/test-utils';
import { defineComponent, isReadonly } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEFORE_IMPORT_KEY, createFamilyStore, STORAGE_KEY, type FamilyStore } from './useFamily';
import { emptyFamily } from '@/domain/family';

const wrappers: ReturnType<typeof mount>[] = [];

function setup() {
  let store!: FamilyStore;
  wrappers.push(
    mount(
      defineComponent({
        setup() {
          store = createFamilyStore({ connect: false });

          return () => null;
        },
      }),
    ),
  );

  return store;
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
});
const profile = {
  name: '小树之家',
  nickname: '小叶',
  dueDate: '2027-01-26',
  quietMode: false,
};

describe('本地存档', () => {
  it('本机档案对消费者深度只读', async () => {
    const store = setup();
    await store.saveProfile(profile);
    expect(isReadonly(store.localProfile)).toBe(true);
    expect(isReadonly(store.localProfile.value)).toBe(true);
  });
  it('每周计划只允许当日符合规则时打卡，修改周期保留历史并能刷新恢复', async () => {
    const store = setup();
    const id = crypto.randomUUID();
    await store.addTask(
      { title: '每周整理', date: '2026-10-21', time: '09:00', repeat: 'weekly', weekdays: [3, 5] },
      id,
    );
    expect(await store.toggleTask(id, '2026-10-22')).toBe(false);
    expect(await store.toggleTask(id, '2026-10-21')).toBe(true);
    const stored = store.data.value.tasks[0]!;
    const before = { ...stored, completedDates: [...stored.completedDates] };
    const { weekdays: _weekdays, ...rest } = before;
    expect(_weekdays).toEqual([3, 5]);
    await store.updateTask({ ...rest, repeat: 'daily' }, before);
    expect(setup().data.value.tasks[0]!.completedDates).toEqual(['2026-10-21']);
    expect(await store.toggleTask(id, '2026-10-22')).toBe(true);
  });
  it('产检完成和费用在本机写入失败时一起回滚，重试可以恢复', () => {
    const store = setup();
    const before = {
      id: 'visit',
      type: 'checkup' as const,
      title: '产检',
      date: '2026-10-21',
      notes: '',
      completed: false,
    };
    store.savePregnancy({ type: 'pregnancy', before: null, value: before });
    const original = localStorage.getItem(STORAGE_KEY);
    const storage = localStorage;
    vi.stubGlobal('localStorage', {
      getItem: storage.getItem.bind(storage),
      setItem: () => {
        throw new Error('Quota exceeded');
      },
    });
    const change = {
      type: 'pregnancy' as const,
      before,
      value: { ...before, completed: true },
      expense: {
        id: 'checkup-visit',
        title: '产检',
        date: before.date,
        kind: 'expense' as const,
        category: '产检医疗' as const,
        amountCents: 10000,
        reimbursedCents: 0,
      },
    };
    expect(store.savePregnancy(change)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
    expect(store.data.value.expenses).toHaveLength(0);
    expect(store.data.value.pregnancyRecords).toEqual([before]);
    vi.unstubAllGlobals();
    expect(store.savePregnancy(change)).toBe(true);
    expect(setup().data.value.expenses).toHaveLength(1);
    expect(setup().data.value.pregnancyRecords).toEqual([change.value]);
  });
  it('预览不写入，确认恢复保留原副本，支持损坏存档恢复', async () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const store = setup();
    const target = store.importTarget();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
    expect(
      await store.importBackup(
        JSON.stringify({ ...emptyFamily(), profile }),
        target,
        'import-operation',
      ),
    ).toBe(true);
    expect(localStorage.getItem(BEFORE_IMPORT_KEY)).toBe('{broken');
    expect(store.locked.value).toBe(false);
    expect(setup().data.value.profile).toEqual(profile);
  });

  it('无效备份、过时预览和存储失败都不覆盖记录', async () => {
    const store = setup();
    store.saveProfile(profile);
    const before = localStorage.getItem(STORAGE_KEY);
    const target = store.importTarget();
    await expect(store.importBackup('{invalid', target, 'operation')).rejects.toThrow(
      '备份格式无效',
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    const next = JSON.stringify(emptyFamily());
    store.saveProfile({ ...profile, name: '已更新' });
    await expect(store.importBackup(next, target, 'operation')).rejects.toThrow('本机记录已变化');
    const updated = localStorage.getItem(STORAGE_KEY);
    const latest = store.importTarget();
    vi.stubGlobal('localStorage', {
      getItem: localStorage.getItem.bind(localStorage),
      setItem: () => {
        throw new Error('Quota exceeded');
      },
    });
    await expect(store.importBackup(next, latest, 'operation')).rejects.toThrow('Quota exceeded');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(updated);
    expect(store.data.value.profile?.name).toBe('已更新');
  });
  it('家庭、账本与打卡可在新实例恢复，每日打卡相互独立', () => {
    const store = setup();
    expect(store.saveProfile(profile)).toBe(true);
    store.addTask({
      title: '写下今天的心情',
      date: '2026-10-09',
      time: '20:00',
      repeat: 'daily',
    });
    const id = store.data.value.tasks[0].id;
    store.toggleTask(id, '2026-10-09');
    store.toggleTask(id, '2026-10-10');
    store.toggleTask(id, '2026-10-09');
    store.addExpense({
      title: '账目',
      date: '2026-10-09',
      kind: 'expense',
      category: '其他',
      amountCents: 1020,
      reimbursedCents: 0,
    });
    const restored = setup();
    expect(restored.data.value.profile).toEqual(profile);
    expect(restored.data.value.tasks[0].completedDates).toEqual(['2026-10-10']);
    expect(restored.data.value.expenses[0].amountCents).toBe(1020);
  });
  it('写入失败不展示成功状态，也不覆盖已保存记录', () => {
    const store = setup();
    store.saveProfile(profile);
    const original = localStorage.getItem(STORAGE_KEY);
    // Replace the boundary: happy-dom's Storage proxy hides method descriptors,
    // so an instance method spy cannot be reliably restored between tests.
    vi.stubGlobal('localStorage', {
      getItem: localStorage.getItem.bind(localStorage),
      setItem: () => {
        throw new Error('Quota exceeded');
      },
    });
    expect(store.saveProfile({ ...profile, name: '新名称' })).toBe(false);
    expect(store.data.value.profile?.name).toBe(profile.name);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
    expect(store.error.value).toContain('保存失败');
  });
  it('损坏存档保持原样，禁止写入', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    const store = setup();
    expect(store.locked.value).toBe(true);
    expect(store.saveProfile(profile)).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
  });
  it('发现其他页面已写入时停止覆盖', () => {
    const first = setup();
    const second = setup();
    first.saveProfile(profile);
    expect(second.saveProfile({ ...profile, name: '过时页面' })).toBe(false);
    expect(second.error.value).toContain('另一个页面');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).profile.name).toBe(profile.name);
  });
  it('页面跨过本地午夜后自动切换今日计划', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 23, 59, 50));
    const store = setup();
    store.addTask({
      title: '明天的事',
      date: '2026-10-10',
      time: '09:00',
      repeat: 'once',
    });
    expect(store.todayTasks.value).toHaveLength(0);
    vi.advanceTimersByTime(30000);
    expect(store.today.value).toBe('2026-10-10');
    expect(store.todayTasks.value).toHaveLength(1);
  });
});
