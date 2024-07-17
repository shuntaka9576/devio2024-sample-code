import {
  type DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { Effect, pipe } from 'effect';
import { DateTime } from 'luxon';
import { UserID, UserName } from '../domain/models/user';
import { config } from '../utils/config';
import { DataBaseUnknownError } from './common/errors';

export const getUserIDByUserName =
  (client: DynamoDBDocumentClient) => (userName: UserName) =>
    pipe(
      Effect.tryPromise({
        try: async () =>
          client.send(
            new QueryCommand({
              TableName: `${config.envName}-User`,
              IndexName: 'userNameIndex',
              KeyConditionExpression: 'userName = :userName',
              ExpressionAttributeValues: {
                ':userName': userName,
              },
            })
          ),
        catch: (error) => new DataBaseUnknownError({ error }),
      }),
      Effect.flatMap((result) => {
        if (!result.Items || result.Items.length === 0) {
          return Effect.succeed(undefined);
        }

        if (result.Items && result.Items.length === 1) {
          return pipe(
            UserID(result.Items[0].userID),
            Effect.mapError((error) => new DataBaseUnknownError({ error }))
          );
        }

        return Effect.fail(
          new DataBaseUnknownError({ error: 'invalidUserDataUser' })
        );
      })
    );

export const getUser =
  (client: DynamoDBDocumentClient) =>
  (
    userID: UserID
  ): Effect.Effect<
    { userID: UserID; userName: UserName } | undefined,
    DataBaseUnknownError,
    never
  > =>
    pipe(
      Effect.tryPromise({
        try: async () =>
          client.send(
            new GetCommand({
              TableName: `${config.envName}-User`,
              Key: {
                userID,
                ID: userID,
              },
            })
          ),
        catch: (error) => new DataBaseUnknownError({ error }),
      }),
      Effect.flatMap((result) => {
        if (!result.Item) {
          return Effect.succeed(undefined);
        }

        return pipe(
          Effect.all({
            userID: UserID(result.Item?.userID),
            userName: UserName(result.Item?.userName),
          }),
          Effect.map(({ userID, userName }) => ({ userID, userName }))
        );
      }),
      Effect.mapError((error) => new DataBaseUnknownError({ error }))
    );

export const createUser =
  (client: DynamoDBDocumentClient) =>
  (params: {
    userID: UserID;
    userName: UserName;
    credentialID?: string;
    credentialPublicKey?: Uint8Array;
    transports?: AuthenticatorTransportFuture[];
  }) =>
    pipe(
      Effect.succeed(DateTime.now().toMillis()),
      Effect.map((now) => ({
        TransactItems: [
          {
            Put: {
              TableName: `${config.envName}-User`,
              Item: {
                userID: params.userID,
                ID: params.userID,
                userName: params.userName,
                createdAt: now,
                updatedAt: now,
              },
              ConditionExpression:
                'attribute_not_exists(userID) AND attribute_not_exists(ID)',
            },
          },
          {
            Put: {
              TableName: `${config.envName}-User`,
              Item: {
                userID: params.userID,
                ID: params.credentialID,
                credentialPublicKey: params.credentialPublicKey
                  ? Buffer.from(params.credentialPublicKey).toString('base64')
                  : undefined,
                counter: 0,
                transports: params.transports,
                createdAt: now,
                updatedAt: now,
              },
              ConditionExpression:
                'attribute_not_exists(userID) AND attribute_not_exists(ID)',
            },
          },
        ],
      })),
      Effect.flatMap((param) =>
        Effect.tryPromise({
          try: () => client.send(new TransactWriteCommand(param)),
          catch: (error) => new DataBaseUnknownError({ error }),
        })
      )
    );
