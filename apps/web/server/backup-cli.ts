import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { copyDatabase, verifyDatabase } from './backup.ts';

const [command, source, target] = process.argv.slice(2);

try {
  if (command === 'scheduled' && !source && !target) {
    const database =
      process.env.FAMILY_DB ?? fileURLToPath(new URL('../data/family.sqlite', import.meta.url));
    const directory = process.env.BACKUP_DIR;

    if (!directory) {
      throw new Error('请设置 BACKUP_DIR，为备份提供独立的持久化目录。');
    }

    const filename = `family-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.sqlite`;
    console.log(JSON.stringify(copyDatabase(database, resolve(directory, filename))));
  } else if (command === 'verify' && source && !target) {
    console.log(JSON.stringify(verifyDatabase(resolve(source))));
  } else if ((command === 'backup' || command === 'restore') && source && target) {
    console.log(JSON.stringify(copyDatabase(source, target, command === 'restore')));
  } else {
    throw new Error(
      '用法：node server/backup-cli.ts backup|restore <源数据库> <新目标文件>；verify <数据库>；scheduled',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : '数据库操作失败。');
  process.exitCode = 1;
}
