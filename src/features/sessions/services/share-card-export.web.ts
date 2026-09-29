import type { View } from 'react-native';

import type { SaveCardResult } from './share-card-export';

export type { SaveCardResult };

// expo-media-library has no web implementation and throws on import, so the
// web build must never reach it.
export const canSaveShareCard = false;

export async function saveShareCardToPhotos(_card: View | null): Promise<SaveCardResult> {
  return 'failed';
}
