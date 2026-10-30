import { setDomainStorage, type KeyValueStorage } from '@24years/domain/storage';

/**
 * 把 uni-app 的同步存储注入共享领域层。
 * 领域层只认同步键值接口，浏览器端默认走 localStorage，
 * 小程序端由这里接管，行为保持一致。
 */
export function installDomainStorage(): void {
  const storage: KeyValueStorage = {
    getItem: (key: string): string | null => {
      try {
        const value = uni.getStorageSync(key);

        return value === '' || value === undefined || value === null ? null : String(value);
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      uni.setStorageSync(key, value);
    },
    removeItem: (key: string): void => {
      uni.removeStorageSync(key);
    },
  };

  setDomainStorage(storage);
}
