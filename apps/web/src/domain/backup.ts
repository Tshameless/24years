import { decodeFamily, type FamilyData } from './family';

export const MAX_BACKUP_BYTES = 800000;

export function readFamilyBackup(raw: string): FamilyData {
  if (new TextEncoder().encode(raw).length >= MAX_BACKUP_BYTES) {
    throw new Error('备份超过 800 KB，请拆分整理后重试。');
  }

  try {
    return decodeFamily(raw.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('备份格式无效或版本不受支持，请选择 24Years 导出的 JSON 文件。');
  }
}

export function downloadBackup(raw: string, filename: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
