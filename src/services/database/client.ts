import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export type LocalDatabase = ReturnType<typeof drizzle>;

// Web SQLite uses a worker. Creating a synchronous database while the module
// is being evaluated blocks that worker from starting and eventually times out.
// The database is therefore initialized by DatabaseProvider before any screen
// that uses it is rendered.
export let sqlite!: SQLiteDatabase;
export let database!: LocalDatabase;

export async function initializeDatabase(): Promise<LocalDatabase> {
  if (database) return database;

  const opened = Platform.OS === 'web'
    ? await openDatabaseAsync('hotrocks-v2.db', { enableChangeListener: true })
    : openDatabaseSync('hotrocks-v2.db', { enableChangeListener: true });

  if (Platform.OS === 'web') {
    await opened.execAsync('PRAGMA journal_mode = WAL;');
    await opened.execAsync('PRAGMA foreign_keys = ON;');
    await opened.execAsync('PRAGMA busy_timeout = 5000;');
  } else {
    opened.execSync('PRAGMA journal_mode = WAL;');
    opened.execSync('PRAGMA foreign_keys = ON;');
    opened.execSync('PRAGMA busy_timeout = 5000;');
  }

  sqlite = opened;
  database = drizzle(opened);

  return database;
}
