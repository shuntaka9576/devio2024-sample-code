import { type DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { AuthenticatorDevice } from '@simplewebauthn/types';
import { Effect } from 'effect';
import type { UserID } from '../domain/models/user';
import { config } from '../utils/config';
import { DataBaseUnknownError } from './common/errors';

export const getAuthenticatorDevice =
  (client: DynamoDBDocumentClient) =>
  (params: {
    userID: UserID;
    credentialID: string;
  }): Effect.Effect<
    AuthenticatorDevice | undefined,
    DataBaseUnknownError,
    never
  > =>
    Effect.gen(function* () {
      return yield* Effect.tryPromise({
        try: async () => {
          const result = await client.send(
            new GetCommand({
              TableName: `${config.envName}-User`,
              Key: {
                userID: params.userID,
                ID: params.credentialID,
              },
            })
          );

          if (result.Item == null) {
            return undefined;
          }

          return {
            credentialID: result.Item.ID,
            credentialPublicKey: result.Item.credentialPublicKey
              ? Buffer.from(result.Item.credentialPublicKey, 'base64')
              : undefined,
            counter: result.Item.counter,
            transports: result.Item.transports,
          } as AuthenticatorDevice;
        },
        catch: (error) => new DataBaseUnknownError({ error }),
      });
    });
