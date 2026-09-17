import * as Crypto from 'expo-crypto';
import { monotonicFactory } from 'ulid';

function securePrng(): number {
  const bytes = new Uint8Array(1);
  Crypto.getRandomValues(bytes);
  return bytes[0] / 256;
}

const createMonotonicUlid = monotonicFactory(securePrng);

export function createId(): string {
  return createMonotonicUlid();
}
