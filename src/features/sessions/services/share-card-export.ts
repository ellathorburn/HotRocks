import { Asset, requestPermissionsAsync } from 'expo-media-library';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export type SaveCardResult = 'saved' | 'denied' | 'failed';

export const canSaveShareCard = true;

/** Snapshots the share card and writes it to the device photo library. */
export async function saveShareCardToPhotos(card: View | null): Promise<SaveCardResult> {
  if (!card) return 'failed';
  try {
    const { granted } = await requestPermissionsAsync(true, ['photo']);
    if (!granted) return 'denied';
    const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
    await Asset.create(uri);
    return 'saved';
  } catch {
    return 'failed';
  }
}
