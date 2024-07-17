import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ArrayFormatter, Schema } from '@effect/schema';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';
import { Effect, pipe } from 'effect';
import { type Context, Hono } from 'hono';
import { CookieStore, type Session, sessionMiddleware } from 'hono-sessions';
import type { LambdaContext, LambdaEvent } from 'hono/aws-lambda';
import { cors } from 'hono/cors';
import type { StatusCode } from 'hono/utils/http-status';
import {
  UserID,
  UserName,
  userIDSchema,
  userNameSchema,
} from './domain/models/user';
import { checkUserWorkflow } from './domain/workflows/auth/check-session-workflow';
import { generateAuthenticationOptionsWorkflow } from './domain/workflows/auth/generate-authentication-options-workflow';
import { generateRegistrationOptionsWorkflow } from './domain/workflows/auth/generate-registration-options-workflow';
import { verifyAuthenticationWorkflow } from './domain/workflows/auth/verify-authentication-workflow';
import { verifyRegistrationOptionsWorkflow } from './domain/workflows/auth/verify-registration-workflow';
import { setMetaDataMiddleware } from './middlewares/async-local-storage';
import { getAuthenticatorDevice } from './repos/authenticator-repository';
import {
  createUser,
  getUser,
  getUserIDByUserName,
} from './repos/user-repository';
import { config } from './utils/config';
import { logger } from './utils/logger';

const dynamodbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient());

type Bindings = {
  event?: LambdaEvent & {
    httpMethod?: string;
    path?: string;
  };
  lambdaContext?: LambdaContext;
};

export type AppContext = Context<{
  Bindings: Bindings;
  Variables: {
    session: Session;
    session_key_rotation: boolean;
  };
}>;

const app = new Hono<{
  Bindings: Bindings;
  Variables: {
    session: Session;
    session_key_rotation: boolean;
  };
}>();

app.use(setMetaDataMiddleware());
app.use(
  '*',
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

app.use(
  '*',
  sessionMiddleware({
    store: new CookieStore(),
    encryptionKey: config.cookie.encryptionKey,
    expireAfterSeconds: 172_800, // 48(h)
    cookieOptions: {
      sameSite: 'Lax',
      domain: config.cookie.fields.domain,
      httpOnly: true,
      secure: true,
    },
  })
);

app.get('/auth/session', async (c: AppContext) => {
  const toValidSchema = Schema.Struct({
    userID: userIDSchema,
    isLoggedIn: Schema.Literal(true),
  });

  const session = c.get('session');
  const workflow = checkUserWorkflow(getUser(dynamodbDocClient));

  const result = await pipe(
    {
      isLoggedIn: session.get('isLoggedIn'),
      userID: session.get('userID'),
    },
    Schema.decodeUnknownEither(toValidSchema),
    Effect.flatMap(workflow),
    Effect.match({
      onSuccess: (result) => ({
        status: 200,
        body: { isLoggedIn: result.isLoggedIn, user: result.user },
      }),
      onFailure: (error) => {
        switch (error._tag) {
          case 'ParseError':
            return { status: 200, body: { isLoggedIn: false } };
          case 'NotFoundUserError':
            return { status: 400, body: { isLoggedIn: false } };
          case 'DataBaseUnknownError':
            logger.info(error);

            return { status: 500, body: { code: 'InternalServerError' } };
        }
      },
    }),
    Effect.runPromise
  );

  return c.json(result.body, result.status as StatusCode);
});

app.post('/auth/logout', async (c: AppContext) => {
  const session = c.get('session');

  session.deleteSession();
  return c.json({ success: true }, 200);
});

app.post('/auth/generate-registration-options', async (c: AppContext) => {
  const toValidSchema = Schema.Struct({
    userName: userNameSchema,
  });

  const workflow = generateRegistrationOptionsWorkflow(
    getUserIDByUserName(dynamodbDocClient)
  );

  const result = await pipe(
    Effect.tryPromise(() => c.req.json()),
    Effect.flatMap((unValidatedParams) =>
      Schema.decodeUnknownEither(toValidSchema)(unValidatedParams)
    ),
    Effect.flatMap((validatedParams) => workflow(validatedParams.userName)),
    Effect.map((result) => {
      const session = c.get('session');
      if (session) {
        session.set('userID', result.userID);
        session.set(
          'challenge',
          result.publicKeyCredentialCreationOptionsJSON.challenge
        );
        session.set(
          'userName',
          result.publicKeyCredentialCreationOptionsJSON.user.name
        );
      }
      return result;
    }),
    Effect.match({
      onSuccess: (result) => ({
        status: 200,
        body: result.publicKeyCredentialCreationOptionsJSON,
      }),
      onFailure: (error) => {
        switch (error._tag) {
          case 'ParseError': {
            const errors = ArrayFormatter.formatErrorSync(error).map(
              (error) => ({
                field: error.path[0],
              })
            );

            return { status: 400, body: { code: 'ValidationError', errors } };
          }
          case 'UserAlreadyExistsError':
            return { status: 400, body: { code: 'UserAlreadyExists' } };
          case 'DataBaseUnknownError':
          case 'WorkflowUnknownError':
          case 'UnknownException':
            logger.error(error);

            return { status: 500, body: { code: 'InternalServerError' } };
        }
      },
    }),
    Effect.runPromise
  );

  return c.json(result.body, result.status as StatusCode);
});

app.post('/auth/verify-registration', async (c: AppContext) => {
  const workflow = verifyRegistrationOptionsWorkflow(
    createUser(dynamodbDocClient)
  );

  const result = await Effect.gen(function* () {
    const body = yield* Effect.tryPromise(() => c.req.json());

    const session = c.get('session');
    const userID = session.get('userID') as string;
    const challenge = session.get('challenge') as string;
    const userName = session.get('userName') as string;

    return {
      registrationResponseJSON: body as RegistrationResponseJSON,
      userID: yield* UserID(userID),
      userName: yield* UserName(userName),
      challenge,
    };
  }).pipe(
    Effect.flatMap(workflow),
    Effect.match({
      onSuccess: (result) => {
        const session = c.get('session');
        session.set('challenge', undefined);
        session.set('isLoggedIn', true);
        session.set('userID', result.userID);

        return { status: 200, body: { verified: result.verified } };
      },
      onFailure: (error) => {
        switch (error._tag) {
          case 'ParseError':
          case 'DataBaseUnknownError':
          case 'WorkflowUnknownError':
          case 'UnknownException':
            logger.error(error);

            return { status: 500, body: { code: 'InternalServerError' } };
        }
      },
    }),
    Effect.runPromise
  );

  return c.json(result.body, result.status as StatusCode);
});

app.post('/auth/generate-authentication-options', async (c: AppContext) => {
  const workflow = generateAuthenticationOptionsWorkflow();

  const result = await pipe(
    workflow,
    Effect.match({
      onSuccess: (result) => {
        const session = c.get('session');
        session.set('challenge', result.challenge);

        return { status: 200, body: result };
      },
      onFailure: (error) => {
        switch (error._tag) {
          case 'WorkflowUnknownError':
            logger.error(error);

            return { status: 500, body: { code: 'InternalServerError' } };
        }
      },
    }),
    Effect.runPromise
  );

  return c.json(result.body, result.status as StatusCode);
});

app.post('/auth/verify-authentication', async (c: AppContext) => {
  const workflow = verifyAuthenticationWorkflow(
    getAuthenticatorDevice(dynamodbDocClient)
  );

  const result = await pipe(
    Effect.tryPromise(() => c.req.json()),
    Effect.flatMap((req) => {
      const session = c.get('session');
      const challenge = session.get('challenge') as string;

      return Effect.succeed({
        authenticationResponseJSON: req as AuthenticationResponseJSON,
        challenge: challenge,
      });
    }),
    Effect.flatMap(workflow),
    Effect.match({
      onSuccess: (result) => {
        const session = c.get('session');
        session.set('isLoggedIn', true);
        session.set('userID', result.userID);

        return { status: 200, body: { verified: result.verified } };
      },
      onFailure: (error) => {
        switch (error._tag) {
          case 'AuthenticatorNotFoundError':
            return { status: 400, body: { code: 'InvalidRequest' } };
          case 'UnknownException':
          case 'DataBaseUnknownError':
          case 'WorkflowUnknownError':
            logger.error(error);

            return { status: 500, body: { code: 'InternalServerError' } };
        }
      },
    }),
    Effect.runPromise
  );

  return c.json(result.body, result.status as StatusCode);
});

export default app;
