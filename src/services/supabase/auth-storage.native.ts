import * as SecureStore from 'expo-secure-store';

const chunkSize = 1800;

function chunkKey(key: string, index: number) {
  return `${key}.chunk.${index}`;
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    const storedChunkCount = await SecureStore.getItemAsync(`${key}.chunks`);
    if (storedChunkCount === null) {
      return null;
    }

    const chunkCount = Number.parseInt(storedChunkCount, 10);
    if (!Number.isSafeInteger(chunkCount) || chunkCount < 1) {
      await authStorage.removeItem(key);
      return null;
    }

    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );

    return chunks.every((chunk): chunk is string => chunk !== null)
      ? chunks.join('')
      : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousChunkCount = Number.parseInt(
      (await SecureStore.getItemAsync(`${key}.chunks`)) ?? '0',
      10,
    );
    const chunks = value.match(new RegExp(`.{1,${chunkSize}}`, 'gs')) ?? [''];

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(`${key}.chunks`, String(chunks.length));

    if (previousChunkCount > chunks.length) {
      await Promise.all(
        Array.from(
          { length: previousChunkCount - chunks.length },
          (_, index) =>
            SecureStore.deleteItemAsync(chunkKey(key, chunks.length + index)),
        ),
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    const storedChunkCount = await SecureStore.getItemAsync(`${key}.chunks`);
    const chunkCount = Number.parseInt(storedChunkCount ?? '0', 10);

    await Promise.all([
      SecureStore.deleteItemAsync(`${key}.chunks`),
      ...Array.from(
        { length: Number.isSafeInteger(chunkCount) ? chunkCount : 0 },
        (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index)),
      ),
    ]);
  },
};
