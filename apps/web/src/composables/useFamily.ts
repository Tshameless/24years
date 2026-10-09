import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  readonly,
  ref,
  shallowRef,
  watch,
  type InjectionKey,
} from 'vue';
import {
  decodeFamily,
  emptyFamily,
  localDate,
  taskIsDue,
  validExpense,
  validProfile,
  validTask,
  type Expense,
  type FamilyData,
  type FamilyProfile,
  type FamilyTask,
} from '@/domain/family';

export const STORAGE_KEY = '24years.family.v1';

export function createFamilyStore() {
  const data = ref<FamilyData>(emptyFamily());
  const error = shallowRef('');
  const locked = shallowRef(false);
  const today = shallowRef(localDate());

  let lastSaved: string | null = null;

  try {
    lastSaved = localStorage.getItem(STORAGE_KEY);

    if (lastSaved !== null) {
      data.value = decodeFamily(lastSaved);
    }
  } catch {
    locked.value = true;
    error.value = '无法读取本地存档。为保护原始记录，已暂停修改；请先导出备份。';
  }

  function commit(next: FamilyData): boolean {
    if (locked.value) {
      return false;
    }

    try {
      if (localStorage.getItem(STORAGE_KEY) !== lastSaved) {
        error.value = '另一个页面更新了记录，请刷新本页后继续。';
        locked.value = true;

        return false;
      }

      const serialized = JSON.stringify(next);
      localStorage.setItem(STORAGE_KEY, serialized);
      lastSaved = serialized;
      data.value = next;
      error.value = '';

      return true;
    } catch {
      error.value = '保存失败，可能是存储空间不足或浏览器禁止存储。输入已保留，请重试。';

      return false;
    }
  }

  function saveProfile(profile: FamilyProfile): boolean {
    return validProfile(profile) && commit({ ...data.value, profile });
  }

  function addTask(input: Omit<FamilyTask, 'id' | 'completedDates'>): boolean {
    const task = { ...input, id: crypto.randomUUID(), completedDates: [] };

    return validTask(task) && commit({ ...data.value, tasks: [...data.value.tasks, task] });
  }

  function toggleTask(id: string, date = localDate()): boolean {
    const task = data.value.tasks.find((item) => item.id === id);

    if (!task || !taskIsDue(task, date)) {
      return false;
    }

    const completedDates = task.completedDates.includes(date)
      ? task.completedDates.filter((item) => item !== date)
      : [...task.completedDates, date];

    return commit({
      ...data.value,
      tasks: data.value.tasks.map((item) => (item.id === id ? { ...item, completedDates } : item)),
    });
  }

  function addExpense(input: Omit<Expense, 'id'>): boolean {
    const expense = { ...input, id: crypto.randomUUID() };

    return (
      validExpense(expense) &&
      commit({ ...data.value, expenses: [expense, ...data.value.expenses] })
    );
  }

  function exportBackup() {
    try {
      const raw = locked.value
        ? localStorage.getItem(STORAGE_KEY)
        : JSON.stringify(data.value, null, 2);
      const url = URL.createObjectURL(new Blob([raw ?? '{}'], { type: 'application/json' }));
      const link = document.createElement('a');

      link.href = url;
      link.download = `24years-backup-${localDate()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      error.value = '暂时无法导出，请检查浏览器下载与存储权限。';
    }
  }

  const refreshDate = () => {
    today.value = localDate();
  };
  let interval: ReturnType<typeof setInterval>;

  onMounted(() => {
    interval = setInterval(refreshDate, 30000);
    window.addEventListener('focus', refreshDate);
    document.addEventListener('visibilitychange', refreshDate);
  });

  onUnmounted(() => {
    clearInterval(interval);
    window.removeEventListener('focus', refreshDate);
    document.removeEventListener('visibilitychange', refreshDate);
  });

  watch(
    () => data.value.theme,
    (theme) => {
      document.documentElement.dataset.theme = theme;
    },
    { immediate: true },
  );

  const todayTasks = computed(() =>
    data.value.tasks
      .filter((task) => taskIsDue(task, today.value))
      .sort((a, b) => a.time.localeCompare(b.time)),
  );

  return {
    data: readonly(data),
    error: readonly(error),
    locked: readonly(locked),
    today: readonly(today),
    todayTasks,
    saveProfile,
    addTask,
    toggleTask,
    addExpense,
    exportBackup,
    removeTask: (id: string) =>
      commit({
        ...data.value,
        tasks: data.value.tasks.filter((task) => task.id !== id),
      }),
    removeExpense: (id: string) =>
      commit({
        ...data.value,
        expenses: data.value.expenses.filter((expense) => expense.id !== id),
      }),
    toggleTheme: () =>
      commit({
        ...data.value,
        theme: data.value.theme === 'light' ? 'dark' : 'light',
      }),
  };
}

export type FamilyStore = ReturnType<typeof createFamilyStore>;
export const familyKey: InjectionKey<FamilyStore> = Symbol('family');

export function useFamily(): FamilyStore {
  const store = inject(familyKey);

  if (!store) {
    throw new Error('Family provider is missing');
  }

  return store;
}
