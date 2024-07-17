import type { ParseError } from '@effect/schema/ParseResult';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { Data, Effect, pipe } from 'effect';
import type { DataBaseUnknownError } from '../../../repos/common/errors';
import { config } from '../../../utils/config';
import { UserID, type UserName } from '../../models/user';
import { WorkflowUnknownError } from '../common/errors';

class UserAlreadyExistsError extends Data.TaggedError(
  'UserAlreadyExistsError'
)<{
  userName: UserName;
}> {}

export const generateRegistrationOptionsWorkflow =
  (
    getUserIDByUserName: (
      userName: UserName
    ) => Effect.Effect<UserID | undefined, DataBaseUnknownError | ParseError>
  ) =>
  (userName: UserName) =>
    pipe(
      getUserIDByUserName(userName),
      Effect.flatMap((userID) =>
        userID != null
          ? Effect.fail(new UserAlreadyExistsError({ userName }))
          : Effect.sync(() => crypto.randomUUID())
      ),
      Effect.flatMap((uuid) => UserID(uuid)),
      Effect.flatMap((newUserID) =>
        Effect.tryPromise({
          try: async () => {
            const options = await generateRegistrationOptions({
              rpName: config.auth.rpName,
              rpID: config.auth.rpID,
              userName: userName,
              userDisplayName: userName,
              userID: new TextEncoder().encode(newUserID),
              timeout: 60000,
              attestationType: 'none',
              excludeCredentials: [],
              authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'required',
              },
              supportedAlgorithmIDs: [-7, -257],
            });

            return {
              userID: newUserID,
              publicKeyCredentialCreationOptionsJSON: options,
            };
          },
          catch: (error) => new WorkflowUnknownError({ error }),
        })
      )
    );
