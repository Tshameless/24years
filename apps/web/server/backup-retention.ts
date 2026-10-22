import { readdirSync, lstatSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyDatabase } from './backup.ts';

export function pruneBackups(directory: string, latest: string, days = 30, minimum = 8) {
  if (!Number.isInteger(days) || days < 1 || !Number.isInteger(minimum) || minimum < 2) {
    throw new Error('Backup retention requires positive days and at least two copies.');
  }

  const root = resolve(directory);
  const files = readdirSync(root)
    .flatMap((name) => {
      if (!/^family-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{8}\.sqlite$/.test(name)) {
        return [];
      }

      const path = resolve(root, name);
      const stat = lstatSync(path);

      return stat.isFile() && !stat.isSymbolicLink() ? [{ path, time: stat.mtimeMs }] : [];
    })
    .sort((a, b) => b.time - a.time);

  if (!files.some((file) => file.path === resolve(latest))) {
    throw new Error('The verified backup must be in the retention directory.');
  }

  verifyDatabase(latest);
  const removed: string[] = [];

  for (const file of files.slice(minimum)) {
    if (file.path !== resolve(latest) && file.time < Date.now() - days * 86400000) {
      unlinkSync(file.path);
      removed.push(file.path);
    }
  }

  return removed;
}
