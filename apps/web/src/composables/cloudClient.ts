import type { SessionState } from '@/domain/collaboration';
import { isObject, type FamilyData } from '@/domain/family';

export type CloudResponse = SessionState & {
  invitation?: { code: string; expiresAt: string };
  recoveryKey?: string;
  backupData?: FamilyData;
};

export class RequestError extends Error {
  status: number;
  state?: SessionState;

  constructor(status: number, message: string, state?: SessionState) {
    super(message);
    this.status = status;
    this.state = state;
  }
}

export async function parseCloudResponse(response: Response): Promise<CloudResponse> {
  let result: unknown = null;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    if (isObject(result) && typeof result.message === 'string') {
      throw new RequestError(
        response.status,
        result.message,
        isObject(result.state) && 'user' in result.state && 'family' in result.state
          ? (result.state as unknown as SessionState)
          : undefined,
      );
    }

    if (response.status >= 500) {
      throw new TypeError('Gateway unavailable');
    }

    throw new RequestError(response.status, '请求失败，请重试。');
  }

  if (!isObject(result) || !('user' in result) || !('family' in result)) {
    throw new TypeError('Invalid session payload');
  }

  return result as unknown as CloudResponse;
}

export async function request(path: string, body?: unknown): Promise<CloudResponse> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? {} : { 'Content-Type': 'application/json', 'X-24Years-Client': 'web' },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  return parseCloudResponse(response);
}
