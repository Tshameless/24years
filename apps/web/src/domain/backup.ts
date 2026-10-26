import { decodeFamily, type FamilyData } from './family';
import { MAX_BACKUP_BYTES } from './capacity';

export { MAX_BACKUP_BYTES } from './capacity';

export function readFamilyBackup(raw: string): FamilyData {
  if (new TextEncoder().encode(raw).length >= MAX_BACKUP_BYTES) {
    throw new Error('备份文件需小于 32 MiB，原记录未修改。');
  }

  try {
    return decodeFamily(raw.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('备份格式无效或版本不受支持，请选择 24Years 导出的 JSON 文件。');
  }
}

export function downloadBackup(
  raw: string,
  filename: string,
  type = 'application/json;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob([raw], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  try {
    document.body?.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
