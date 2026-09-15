import { monotonicFactory } from 'ulid';

const createMonotonicUlid = monotonicFactory();

export function createId(): string {
  return createMonotonicUlid();
}
