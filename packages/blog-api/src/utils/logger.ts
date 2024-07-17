import pino from 'pino';
import { asyncLocalStorage } from './async-local-storage';

export const logger = pino({
  level: 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin: () => {
    return {
      requestId: asyncLocalStorage.getStore()?.requestId,
      httpMethod: asyncLocalStorage.getStore()?.httpMethod,
      path: asyncLocalStorage.getStore()?.path,
    };
  },
});
