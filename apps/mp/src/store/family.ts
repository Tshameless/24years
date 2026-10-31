import { reactive } from 'vue';

import { createId } from '@24years/domain/id';
import { decodeFamily, emptyFamily, type FamilyData } from '@24years/domain/family';
import type { FamilyProfile } from '@24years/domain/profile';
import type { FamilyTask } from '@24years/domain/tasks';
import type { Expense } from '@24years/domain/ledger';
import type { Child } from '@24years/domain/child';
import {
  applyPregnancyChange,
  type PregnancyChange,
  type PregnancyRecord,
} from '@24years/domain/pregnancy';

export const FAMILY_STORAGE_KEY = '24years.family.v2';

interface FamilyState {
  data: FamilyData;
  loaded: boolean;
  damaged: boolean;
}

export const familyStore = reactive<FamilyState>({
  data: emptyFamily(),
  loaded: false,
  damaged: false,
});

function clone(data: FamilyData): FamilyData {
  return JSON.parse(JSON.stringify(data)) as FamilyData;
}

type FamilyChangeListener = () => void;

const changeListeners = new Set<FamilyChangeListener>();

/**
 * 订阅本地数据变更。云同步层通过它感知写入并负责上传，
 * store 本身不反向依赖云，离线也能正常工作。
 */
export function onFamilyChange(listener: FamilyChangeListener): () => void {
  changeListeners.add(listener);

  return () => {
    changeListeners.delete(listener);
  };
}

function notifyChange(): void {
  changeListeners.forEach((listener) => listener());
}

function persist(): void {
  try {
    uni.setStorageSync(FAMILY_STORAGE_KEY, JSON.stringify(familyStore.data));
  } catch {
    uni.showToast({ title: '本机保存失败，请检查存储空间', icon: 'none' });
  }

  notifyChange();
}

export function loadFamily(): void {
  if (familyStore.loaded) {
    return;
  }

  try {
    const raw = uni.getStorageSync(FAMILY_STORAGE_KEY);

    if (raw) {
      familyStore.data = decodeFamily(String(raw));
    }
  } catch {
    // 损坏存档原样保留，不覆盖，交由用户在设置页处理。
    familyStore.damaged = true;
  }

  familyStore.loaded = true;
}

/** 所有写操作统一走这里：改副本 → 整体替换 → 落盘，保证刷新不丢。 */
export function updateFamily(mutate: (draft: FamilyData) => void): void {
  const draft = clone(familyStore.data);

  mutate(draft);
  familyStore.data = draft;
  persist();
}

export function replaceFamily(data: FamilyData): void {
  familyStore.data = clone(data);
  persist();
}

export function setProfile(profile: FamilyProfile | null): void {
  updateFamily((draft) => {
    draft.profile = profile;
  });
}

export function addTask(task: Omit<FamilyTask, 'id'> & { id?: string }): void {
  updateFamily((draft) => {
    draft.tasks = [...draft.tasks, { ...task, id: task.id ?? createId() } as FamilyTask];
  });
}

export function updateTask(id: string, patch: Partial<FamilyTask>): void {
  updateFamily((draft) => {
    draft.tasks = draft.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task));
  });
}

export function removeTask(id: string): void {
  updateFamily((draft) => {
    draft.tasks = draft.tasks.filter((task) => task.id !== id);
  });
}

export function toggleTaskCompletion(id: string, date: string): void {
  updateFamily((draft) => {
    draft.tasks = draft.tasks.map((task) => {
      if (task.id !== id) {
        return task;
      }

      const done = task.completedDates.includes(date);

      return {
        ...task,
        completedDates: done
          ? task.completedDates.filter((item) => item !== date)
          : [...task.completedDates, date].sort(),
      };
    });
  });
}

export function addExpense(expense: Omit<Expense, 'id'> & { id?: string }): void {
  updateFamily((draft) => {
    draft.expenses = [...draft.expenses, { ...expense, id: expense.id ?? createId() } as Expense];
  });
}

export function updateExpense(id: string, patch: Partial<Expense>): void {
  updateFamily((draft) => {
    draft.expenses = draft.expenses.map((item) => (item.id === id ? { ...item, ...patch } : item));
  });
}

export function removeExpense(id: string): void {
  updateFamily((draft) => {
    draft.expenses = draft.expenses.filter((item) => item.id !== id);
  });
}

/** 孕期变更走领域层的原子校验，产检完成/待产备齐可同时生成一笔账目。 */
export function applyPregnancy(change: PregnancyChange): void {
  updateFamily((draft) => {
    const next = applyPregnancyChange(draft, change);

    draft.pregnancyRecords = next.pregnancyRecords;
    draft.children = next.children;
    draft.expenses = next.expenses;
  });
}

export function addChild(child: Omit<Child, 'id'> & { id?: string }): void {
  updateFamily((draft) => {
    draft.children = [...draft.children, { ...child, id: child.id ?? createId() } as Child];
  });
}

export function updateChild(id: string, patch: Partial<Child>): void {
  updateFamily((draft) => {
    draft.children = draft.children.map((child) => (child.id === id ? { ...child, ...patch } : child));
  });
}

export function removeChild(id: string): void {
  updateFamily((draft) => {
    draft.children = draft.children.filter((child) => child.id !== id);
  });
}

export function pregnancyRecordsOfType<T extends PregnancyRecord['type']>(type: T) {
  return familyStore.data.pregnancyRecords.filter(
    (record): record is Extract<PregnancyRecord, { type: T }> => record.type === type,
  );
}

export function setTheme(theme: 'light' | 'dark'): void {
  updateFamily((draft) => {
    draft.theme = theme;
  });
}

export function exportFamilyJson(): string {
  return JSON.stringify(familyStore.data, null, 2);
}

export function importFamilyJson(raw: string): void {
  replaceFamily(decodeFamily(raw));
  familyStore.damaged = false;
}
