import { PowerSyncDatabase } from '@powersync/react-native';

import { AppSchema } from './schema';

/**
 * One database instance per filename. It is immediately useful as durable,
 * local-only storage; `connect()` is added once a PowerSync instance URL and
 * Sync Streams are provisioned.
 */
export const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'hotrocks.db',
  },
});

export async function prepareLocalDatabase() {
  await powerSync.waitForReady();
}
