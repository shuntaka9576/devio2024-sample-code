import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorDevice,
} from '@simplewebauthn/types';
import { Data, Effect, pipe } from 'effect';
import type { DataBaseUnknownError } from '../../../repos/common/errors';
import { config } from '../../../utils/config';
import { UserID } from '../../models/user';
import { WorkflowUnknownError } from '../common/errors';

class AuthenticatorNotFoundError extends Data.TaggedError(
  'AuthenticatorNotFoundError'
)<{
  credentialID: string;
}> {}

export const verifyAuthenticationWorkflow =
  (
    getAuthenticatorDevice: (params: {
      userID: UserID;
      credentialID: string;
    }) => Effect.Effect<
      AuthenticatorDevice | undefined,
      DataBaseUnknownError,
      never
    >
  ) =>
  (params: {
    authenticationResponseJSON: AuthenticationResponseJSON;
    challenge: string;
  }) =>
    pipe(
      Effect.succeed(params),
      Effect.flatMap((p) =>
        pipe(
          Effect.fromNullable(p.authenticationResponseJSON.response.userHandle),
          Effect.mapError(
            () => new WorkflowUnknownError({ error: 'notfound userHandle' })
          ),
          Effect.flatMap((userHandle) =>
            pipe(
              Effect.try(() =>
                Buffer.from(userHandle, 'base64').toString('utf-8')
              ),
              Effect.flatMap(UserID),
              Effect.mapError((error) => new WorkflowUnknownError({ error }))
            )
          ),
          Effect.map((userID) => ({ ...p, userID }))
        )
      ),
      Effect.flatMap((p) =>
        pipe(
          getAuthenticatorDevice({
            userID: p.userID,
            credentialID: p.authenticationResponseJSON.id,
          }),
          Effect.flatMap((authenticator) =>
            authenticator
              ? Effect.succeed({ ...p, authenticator })
              : Effect.fail(
                  new AuthenticatorNotFoundError({
                    credentialID: p.authenticationResponseJSON.id,
                  })
                )
          )
        )
      ),
      Effect.flatMap((p) =>
        Effect.tryPromise({
          try: () =>
            verifyAuthenticationResponse({
              response: p.authenticationResponseJSON,
              expectedChallenge: p.challenge,
              expectedOrigin: config.corsOrigin,
              expectedRPID: config.auth.rpID,
              authenticator: p.authenticator,
              requireUserVerification: false,
            }),
          catch: (error) => new WorkflowUnknownError({ error }),
        }).pipe(Effect.map((res) => ({ ...p, verified: res.verified })))
      ),
      Effect.map(({ userID, verified }) => ({
        userID,
        verified,
      }))
    );
