/**
 * 共享领域层的宿主存储适配。
 *
 * 领域逻辑只依赖这个同步键值接口，浏览器端默认使用 `localStorage`，
 * 小程序端由宿主注入 `uni.getStorageSync` / `setStorageSync` / `removeStorageSync`，
 * 两端行为保持一致，领域层不需要判断运行环境。
 */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let activeStorage: KeyValueStorage | null = null;

function createMemoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

let fallbackStorage: KeyValueStorage | null = null;

function browserStorage(): KeyValueStorage {
  const candidate = (globalThis as { localStorage?: KeyValueStorage }).localStorage;

  if (candidate) {
    return candidate;
  }

  fallbackStorage ??= createMemoryStorage();

  return fallbackStorage;
}

export function setDomainStorage(storage: KeyValueStorage): void {
  activeStorage = storage;
}

export function resetDomainStorage(): void {
  activeStorage = null;
}

export function getDomainStorage(): KeyValueStorage {
  return activeStorage ?? browserStorage();
}
