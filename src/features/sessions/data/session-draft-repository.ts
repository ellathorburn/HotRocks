import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { roundSchema } from '../domain/session';
import { createId } from '@/lib/ids';
import { database } from '@/services/database/client';
import { sessionDrafts } from '@/services/database/schema';

export const navigationDraftSchema = z.object({
  schemaVersion: z.literal(1),
  rounds: z.array(roundSchema).min(1),
  venueName: z.string().trim().min(1).max(160).nullable(),
  rating: z.int().min(1).max(5).nullable(),
  note: z.string().max(4000).nullable(),
  startedAt: z.iso.datetime({ offset: true }),
  elapsedSeconds: z.int().positive(),
  entryMethod: z.enum(['manual', 'timer', 'repeat']),
});

export type NavigationDraft = z.infer<typeof navigationDraftSchema>;

export function createSessionDraft(userId: string, input: Omit<NavigationDraft, 'schemaVersion'>): string {
  const id = createId();
  const draft = navigationDraftSchema.parse({ schemaVersion: 1, ...input });
  database.insert(sessionDrafts).values({
    id,
    userId,
    payloadJson: JSON.stringify(draft),
    updatedAt: new Date().toISOString(),
  }).run();
  return id;
}

export function readSessionDraft(id: string, userId: string): NavigationDraft | null {
  const row = database.select({ payloadJson: sessionDrafts.payloadJson })
    .from(sessionDrafts)
    .where(and(eq(sessionDrafts.id, id), eq(sessionDrafts.userId, userId)))
    .get();
  if (!row) return null;

  try {
    return navigationDraftSchema.parse(JSON.parse(row.payloadJson));
  } catch {
    return null;
  }
}

export function updateSessionDraft(
  id: string,
  userId: string,
  update: (draft: NavigationDraft) => NavigationDraft,
): void {
  const current = readSessionDraft(id, userId);
  if (!current) throw new Error('Session draft not found.');
  const next = navigationDraftSchema.parse(update(current));
  database.update(sessionDrafts).set({
    payloadJson: JSON.stringify(next),
    updatedAt: new Date().toISOString(),
  }).where(and(eq(sessionDrafts.id, id), eq(sessionDrafts.userId, userId))).run();
}

export function deleteSessionDraft(id: string, userId: string): void {
  database.delete(sessionDrafts)
    .where(and(eq(sessionDrafts.id, id), eq(sessionDrafts.userId, userId)))
    .run();
}
