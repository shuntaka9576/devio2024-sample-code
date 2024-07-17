import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../route';
import { asyncLocalStorage } from '../utils/async-local-storage';

export const setMetaDataMiddleware = (): MiddlewareHandler => {
  return async (c: AppContext, next) => {
    return asyncLocalStorage.run(
      {
        requestId: c.env.lambdaContext?.awsRequestId,
        path: c.env.event?.path,
        httpMethod: c.env.event?.httpMethod,
      },
      next
    );
  };
};
