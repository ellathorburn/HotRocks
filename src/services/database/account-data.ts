import { eq } from 'drizzle-orm';

import { database } from './client';
import {
  profiles,
  roundParts,
  rounds,
  sessionDrafts,
  sessionPhotos,
  sessions,
  stravaExports,
  syncOutbox,
  syncState,
  venues,
} from './schema';

/** Removes every local row belonging to one account in a single transaction. */
export function purgeLocalAccountData(userId: string): void {
  database.transaction((tx) => {
    tx.delete(syncOutbox).where(eq(syncOutbox.userId, userId)).run();
    tx.delete(syncState).where(eq(syncState.userId, userId)).run();
    tx.delete(sessionDrafts).where(eq(sessionDrafts.userId, userId)).run();
    tx.delete(stravaExports).where(eq(stravaExports.userId, userId)).run();
    tx.delete(sessionPhotos).where(eq(sessionPhotos.userId, userId)).run();
    tx.delete(roundParts).where(eq(roundParts.userId, userId)).run();
    tx.delete(rounds).where(eq(rounds.userId, userId)).run();
    tx.delete(sessions).where(eq(sessions.userId, userId)).run();
    tx.delete(venues).where(eq(venues.userId, userId)).run();
    tx.delete(profiles).where(eq(profiles.userId, userId)).run();
  });
}

