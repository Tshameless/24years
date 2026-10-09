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
import { useCollaboration } from './useCollaboration';
import type { FamilyChange } from '@/domain/collaboration';

export const STORAGE_KEY = '24years.family.v1';

export function createFamilyStore(options: { connect?: boolean } = {}) {
  const localData = ref<FamilyData>(emptyFamily());
  const localError = shallowRef('');
  const localLocked = shallowRef(false);
  const cloud = useCollaboration(options.connect ?? true);
  const data = computed<FamilyData>(
    () =>
      ({
        ...(cloud.active.value
          ? (cloud.state.value.family?.data ?? emptyFamily())
          : localData.value),
        theme: localData.value.theme,
      }) as FamilyData,
  );
  const error = computed(() => cloud.error.value || localError.value);
  const locked = computed(
    () =>
      !cloud.ready.value ||
      (cloud.active.value
        ? cloud.busy.value ||
          cloud.expired.value ||
          !cloud.state.value.family ||
          cloud.role.value === 'viewer'
        : localLocked.value),
  );
  const canManage = computed(() => !cloud.active.value || cloud.role.value === 'owner');
  const identity = computed(() =>
    cloud.active.value ? `${cloud.state.value.user?.id}:${cloud.state.value.family?.id}` : 'local',
  );
  const today = shallowRef(localDate());

  let lastSaved: string | null = null;

  try {
    lastSaved = localStorage.getItem(STORAGE_KEY);

    if (lastSaved !== null) {
      localData.value = decodeFamily(lastSaved);
    }
  } catch {
    localLocked.value = true;
    localError.value = '无法读取本地存档。为保护原始记录，已暂停修改；请先导出备份。';
  }

  function commit(next: FamilyData): boolean {
    if (localLocked.value) {
      return false;
    }

    try {
      if (localStorage.getItem(STORAGE_KEY) !== lastSaved) {
        localError.value = '另一个页面更新了记录，请刷新本页后继续。';
        localLocked.value = true;

        return false;
      }

      const serialized = JSON.stringify(next);
      localStorage.setItem(STORAGE_KEY, serialized);
      lastSaved = serialized;
      localData.value = next;
      localError.value = '';

      return true;
    } catch {
      localError.value = '保存失败，可能是存储空间不足或浏览器禁止存储。输入已保留，请重试。';

      return false;
    }
  }

  function changeRecords(change: FamilyChange, next: FamilyData) {
    if (locked.value) {
      return false;
    }

    return cloud.active.value ? cloud.applyChange(change) : commit(next);
  }

  function saveProfile(profile: FamilyProfile, before = data.value.profile) {
    return (
      validProfile(profile) &&
      canManage.value &&
      changeRecords({ type: 'profile', value: profile, before }, { ...data.value, profile })
    );
  }

  function addTask(input: Omit<FamilyTask, 'id' | 'completedDates'>, id = crypto.randomUUID()) {
    const task = { ...input, id, completedDates: [] };

    return (
      validTask(task) &&
      changeRecords(
        { type: 'task', value: task, before: null },
        { ...data.value, tasks: [...data.value.tasks, task] },
      )
    );
  }

  function updateTask(task: FamilyTask, before: FamilyTask) {
    return (
      validTask(task) &&
      changeRecords(
        { type: 'task', value: task, before },
        {
          ...data.value,
          tasks: data.value.tasks.map((item) => (item.id === task.id ? task : item)),
        },
      )
    );
  }

  function toggleTask(id: string, date = localDate()) {
    const task = data.value.tasks.find((item) => item.id === id);

    if (!task || !taskIsDue(task, date)) {
      return false;
    }

    const completedDates = task.completedDates.includes(date)
      ? task.completedDates.filter((item) => item !== date)
      : [...task.completedDates, date];

    return updateTask({ ...task, completedDates }, task);
  }

  function addExpense(input: Omit<Expense, 'id'>, id = crypto.randomUUID()) {
    const expense = { ...input, id };

    return (
      validExpense(expense) &&
      changeRecords(
        { type: 'expense', value: expense, before: null },
        { ...data.value, expenses: [expense, ...data.value.expenses] },
      )
    );
  }

  function updateExpense(expense: Expense, before: Expense) {
    return (
      validExpense(expense) &&
      changeRecords(
        { type: 'expense', value: expense, before },
        {
          ...data.value,
          expenses: data.value.expenses.map((item) => (item.id === expense.id ? expense : item)),
        },
      )
    );
  }

  function exportBackup() {
    try {
      const raw =
        localLocked.value && !cloud.active.value
          ? localStorage.getItem(STORAGE_KEY)
          : JSON.stringify(data.value, null, 2);
      const url = URL.createObjectURL(new Blob([raw ?? '{}'], { type: 'application/json' }));
      const link = document.createElement('a');

      link.href = url;
      link.download = `24years-backup-${localDate()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      localError.value = '暂时无法导出，请检查浏览器下载与存储权限。';
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
    cloud,
    canManage,
    identity,
    saveProfile,
    addTask,
    toggleTask,
    addExpense,
    updateTask,
    updateExpense,
    exportBackup,
    removeTask: (id: string) =>
      changeRecords(
        {
          type: 'task',
          value: null,
          before: data.value.tasks.find((item) => item.id === id) ?? null,
        },
        {
          ...data.value,
          tasks: data.value.tasks.filter((task) => task.id !== id),
        },
      ),
    removeExpense: (id: string) =>
      changeRecords(
        {
          type: 'expense',
          value: null,
          before: data.value.expenses.find((item) => item.id === id) ?? null,
        },
        {
          ...data.value,
          expenses: data.value.expenses.filter((expense) => expense.id !== id),
        },
      ),
    toggleTheme: () =>
      commit({
        ...localData.value,
        theme: localData.value.theme === 'light' ? 'dark' : 'light',
      }),
    uploadLocal: (mode: 'single' | 'couple') =>
      !localLocked.value && cloud.create(mode, localData.value),
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
