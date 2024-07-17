import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';
import { Effect, pipe } from 'effect';
import type { DataBaseUnknownError } from '../../../repos/common/errors';
import { config } from '../../../utils/config';
import type { UserID, UserName } from '../../models/user';
import { WorkflowUnknownError } from '../common/errors';

const verifyRegistrationAttempt = (
  registrationResponse: RegistrationResponseJSON,
  challenge: string,
  userID: UserID,
  userName: UserName
) =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        const result = await verifyRegistrationResponse({
          response: registrationResponse,
          expectedChallenge: challenge,
          expectedOrigin: config.corsOrigin,
          expectedRPID: config.auth.rpID,
          requireUserVerification: true,
        });
        if (
          !result.registrationInfo?.credentialID ||
          !result.registrationInfo?.credentialPublicKey ||
          !registrationResponse.response.transports
        ) {
          throw new Error('Unexpected registration info');
        }

        return {
          userID,
          userName,
          credentialID: result.registrationInfo.credentialID,
          credentialPublicKey: result.registrationInfo.credentialPublicKey,
          transports: registrationResponse.response.transports,
          verified: result.verified,
        };
      },
      catch: (error) => new WorkflowUnknownError({ error }),
    })
  );

export const verifyRegistrationOptionsWorkflow =
  (
    createUser: (params: {
      userID: UserID;
      userName: UserName;
      credentialID?: string;
      credentialPublicKey?: Uint8Array;
      transports?: AuthenticatorTransportFuture[];
    }) => Effect.Effect<void, DataBaseUnknownError>
  ) =>
  (params: {
    registrationResponseJSON: RegistrationResponseJSON;
    userID: UserID;
    userName: UserName;
    challenge: string;
  }) =>
    pipe(
      verifyRegistrationAttempt(
        params.registrationResponseJSON,
        params.challenge,
        params.userID,
        params.userName
      ),
      Effect.flatMap((verifiedRegistration) =>
        pipe(
          createUser(verifiedRegistration),
          Effect.map(() => ({
            verified: verifiedRegistration.verified,
            userID: params.userID,
          }))
        )
      )
    );
