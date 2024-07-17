import { AsyncLocalStorage } from 'node:async_hooks';

type AsyncStorage = {
  requestId?: string;
  httpMethod?: string;
  path?: string;
};

export const asyncLocalStorage = new AsyncLocalStorage<AsyncStorage>();
