import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFamilyStore, STORAGE_KEY, type FamilyStore } from './useFamily';

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
