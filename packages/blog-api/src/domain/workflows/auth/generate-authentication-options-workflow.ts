import {
  type GenerateAuthenticationOptionsOpts,
  generateAuthenticationOptions,
} from '@simplewebauthn/server';
import { Effect, pipe } from 'effect';
import { config } from '../../../utils/config';
import { WorkflowUnknownError } from '../common/errors';

export const generateAuthenticationOptionsWorkflow = () =>
  pipe(
    Effect.succeed({
      timeout: 60000,
      userVerification: 'preferred',
      rpID: config.auth.rpID,
    } as const satisfies GenerateAuthenticationOptionsOpts),
    Effect.flatMap((opts) =>
      Effect.tryPromise({
        try: () => generateAuthenticationOptions(opts),
        catch: (error) => new WorkflowUnknownError({ error }),
      })
    )
  );
