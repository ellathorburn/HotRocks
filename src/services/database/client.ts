import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

export const sqlite = openDatabaseSync('hotrocks-v2.db', {
  enableChangeListener: true,
});

sqlite.execSync('PRAGMA journal_mode = WAL;');
sqlite.execSync('PRAGMA foreign_keys = ON;');
sqlite.execSync('PRAGMA busy_timeout = 5000;');

export const database = drizzle(sqlite);
