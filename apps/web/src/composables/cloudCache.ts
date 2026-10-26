import { decodeFamily } from '@/domain/family';
import type { SessionState } from '@/domain/collaboration';

export const CLOUD_CACHE_KEY = '24years.cloud.cache.v1';

/** Only a read snapshot; never restores authentication or permission to write. */
export function readCloudCache(): SessionState | null {
  try {
    const saved = JSON.parse(localStorage.getItem(CLOUD_CACHE_KEY) ?? 'null');
    const user = saved?.state?.user;
    const family = saved?.state?.family;

    if (
      saved?.version !== 1 ||
      !Number.isFinite(saved.savedAt) ||
      saved.savedAt > Date.now() ||
      Date.now() - saved.savedAt >= 30 * 86400000 ||
      !user ||
      !['id', 'username', 'nickname'].every((key) => typeof user[key] === 'string') ||
      !family ||
      typeof family.id !== 'string' ||
      !Number.isSafeInteger(family.revision) ||
      family.revision < 0 ||
      !['single', 'couple'].includes(family.mode) ||
      !Array.isArray(family.members) ||
      !family.members.every(
        (member: Record<string, unknown> | null) =>
          member &&
          ['id', 'username', 'nickname'].every((key) => typeof member[key] === 'string') &&
          ['owner', 'editor', 'viewer'].includes(String(member.role)) &&
          (member.familyRole === null ||
            ['mother', 'father', 'single_parent'].includes(String(member.familyRole))),
      ) ||
      !family.members.some((member: { id?: string }) => member?.id === user.id)
    ) {
      return null;
    }

    return {
      user: { id: user.id, username: user.username, nickname: user.nickname },
      family: { ...family, data: decodeFamily(JSON.stringify(family.data)) },
    };
  } catch {
    return null;
  }
}
