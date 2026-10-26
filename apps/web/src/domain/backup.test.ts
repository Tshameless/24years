import { expect, it } from 'vitest';
import { MAX_CLOUD_BYTES, familyBlobBytes, familyBytes } from './capacity';
import { emptyFamily } from './family';
import { readFamilyBackup, MAX_BACKUP_BYTES } from './backup';

function archive(count: number) {
  const data = emptyFamily();
  data.expenses = Array.from({ length: count }, (_, i) => ({
    id: `expense-${i}`,
    title: '日常采购',
    date: '2026-10-22',
    kind: 'expense',
    category: '其他',
    amountCents: 100,
    reimbursedCents: 0,
  }));

  return data;
}

it('restores legacy indented exports exceeding the cloud limit without losing records', () => {
  const data = archive(4500);
  const raw = JSON.stringify(data, null, 2);
  expect(familyBytes(data)).toBeLessThan(MAX_CLOUD_BYTES);
  expect(new TextEncoder().encode(raw).length).toBeGreaterThan(MAX_CLOUD_BYTES);
  expect(readFamilyBackup(raw)).toEqual(data);
  expect(readFamilyBackup(JSON.stringify(data))).toEqual(data);
});

it('allows local archives larger than the cloud quota', () => {
  const data = archive(6500);
  expect(familyBytes(data)).toBeGreaterThan(MAX_CLOUD_BYTES);
  expect(familyBlobBytes(data)).toBeLessThan(MAX_CLOUD_BYTES);
  expect(readFamilyBackup('\uFEFF' + JSON.stringify(data))).toEqual(data);
});

it('rejects oversized files and invalid archives', () => {
  expect(() => readFamilyBackup(' '.repeat(MAX_BACKUP_BYTES))).toThrow('32 MiB');
  expect(() => readFamilyBackup('{}')).toThrow('备份格式无效');
});
