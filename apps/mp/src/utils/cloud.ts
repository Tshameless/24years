import {
  createMiniProgramWorkBuddyCloud,
} from '@tencent-ai/workbuddy-cloud-sdk/miniprogram';

import type { Database } from '@/types/database';

import * as diagnosticsModule from './workbuddy-cloud-diagnostics';

/**
 * publicConfig 注入点。
 * 三个值全部来自 workbuddy_cloud_service 返回的应用级公开配置，
 * 只含可公开的前端标识，不含任何长期凭证——密钥始终留在服务端。
 */
const publicConfig = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_wCEHRWqvOGMetxRtrvDJ4r_B36IbHqU3OaJNx97PxH5gojvXPrbxlL3',
} as const;

type CloudClient = ReturnType<typeof createMiniProgramWorkBuddyCloud<Database>>;
type DiagnosticWxFactory = (originalWx: unknown) => unknown;

let client: CloudClient | null = null;
let unavailableReason = '';

/** 诊断辅助模块是小程序风格源文件，两种导出形态都要兜住。 */
function resolveDiagnosticWxFactory(): DiagnosticWxFactory {
  const direct = (diagnosticsModule as { createDiagnosticWx?: DiagnosticWxFactory })
    .createDiagnosticWx;
  const fallback = (
    diagnosticsModule as { default?: { createDiagnosticWx?: DiagnosticWxFactory } }
  ).default?.createDiagnosticWx;
  const factory = direct ?? fallback;

  if (typeof factory !== 'function') {
    throw new Error('云服务诊断辅助模块未导出 createDiagnosticWx');
  }

  return factory;
}

function resolveWx(): unknown {
  const scope = globalThis as { wx?: unknown };

  if (!scope.wx) {
    throw new Error('当前运行环境不是微信小程序，云同步不可用');
  }

  return scope.wx;
}

/** 是否具备调用云服务所需的宿主环境。 */
export function isCloudAvailable(): boolean {
  try {
    resolveWx();

    return true;
  } catch (error) {
    unavailableReason = error instanceof Error ? error.message : String(error);

    return false;
  }
}

/** 最近一次环境检测失败的原因，用于给用户的提示。 */
export function cloudUnavailableReason(): string {
  return unavailableReason;
}

/** 懒加载的单实例客户端：Auth / Database / Storage 共用同一个会话。 */
export function getCloud(): CloudClient {
  if (client) {
    return client;
  }

  const wx = resolveWx();
  const wrapped = resolveDiagnosticWxFactory()(wx);

  client = createMiniProgramWorkBuddyCloud<Database>({
    endpoint: publicConfig.endpoint,
    publishableKey: publicConfig.publishableKey,
    wx: wrapped as Parameters<typeof createMiniProgramWorkBuddyCloud>[0]['wx'],
  });

  return client;
}
