import { reactive } from 'vue';

import { cloudUnavailableReason, getCloud, isCloudAvailable } from '@/utils/cloud';

export interface CloudAccount {
  id: string;
  name: string;
  avatarUrl: string;
}

interface AuthState {
  /** 会话恢复是否已完成，用于区分「还在恢复」与「确实未登录」。 */
  ready: boolean;
  loading: boolean;
  account: CloudAccount | null;
  error: string;
}

export const authStore = reactive<AuthState>({
  ready: false,
  loading: false,
  account: null,
  error: '',
});

export function isSignedIn(): boolean {
  return authStore.account !== null;
}

function toAccount(user: { id: string; name?: string; avatarUrl?: string }): CloudAccount {
  return {
    id: user.id,
    name: user.name ?? '',
    avatarUrl: user.avatarUrl ?? '',
  };
}

/** 冷启动时恢复会话。失败保持未登录，绝不伪造身份。 */
export async function restoreSession(): Promise<void> {
  if (authStore.ready) {
    return;
  }

  if (!isCloudAvailable()) {
    authStore.error = cloudUnavailableReason();
    authStore.ready = true;

    return;
  }

  const { data: session, error } = await getCloud().auth.getSession();

  authStore.ready = true;

  if (error) {
    authStore.account = null;
    authStore.error = error.message;

    return;
  }

  authStore.account = session?.user ? toAccount(session.user) : null;
  authStore.error = '';
}

function requestLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      success: (result: { code?: string; errMsg?: string }) => {
        if (result.code) {
          resolve(result.code);

          return;
        }

        reject(new Error(result.errMsg || '微信登录未返回有效凭证'));
      },
      fail: (error: { errMsg?: string }) => {
        reject(new Error(error.errMsg || '微信登录失败，请重试'));
      },
    });
  });
}

function readRuntimeAppId(): string {
  const info = uni.getAccountInfoSync() as { miniProgram?: { appId?: string } };
  const appid = info?.miniProgram?.appId;

  if (!appid) {
    throw new Error('读取小程序 AppID 失败，请在微信开发者工具中填写 AppID');
  }

  return appid;
}

/** 微信小程序登录：wx.login 换 code → SDK 换 WorkBuddy 会话。 */
export async function signInWithWechat(): Promise<boolean> {
  if (authStore.loading) {
    return false;
  }

  if (!isCloudAvailable()) {
    authStore.error = cloudUnavailableReason();

    return false;
  }

  authStore.loading = true;
  authStore.error = '';

  try {
    const code = await requestLoginCode();
    const { data: session, error } = await getCloud().auth.signInWithWechat(
      code,
      readRuntimeAppId(),
    );

    if (error || !session) {
      authStore.error = error?.message || '微信登录失败，请重试';

      return false;
    }

    authStore.account = toAccount(session.user);

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '微信登录失败，请重试';

    // 只记录阶段与消息本身，不记录原始错误对象、登录凭证或会话。
    console.error(
      '[WorkBuddy Cloud] login failed',
      JSON.stringify({ stage: 'wechat-login-handler', message }),
    );
    authStore.error = message;

    return false;
  } finally {
    authStore.loading = false;
  }
}

export async function signOut(): Promise<void> {
  await getCloud().auth.signOut();
  authStore.account = null;
  authStore.error = '';
}
