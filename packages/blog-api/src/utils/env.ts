import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import * as z from 'zod';

export const envNameSchema = z.union([z.literal('dev'), z.literal('prd')]);

const environmentVariablesSchema = z.object({
  ENV_NAME: envNameSchema,
  COOKIE_DOMAIN: z.string(),
  CORS_ORIGIN: z.string(),
  AWS_SECRETS_COOKIE_ENCRYPTION_KEY: z.string(),
  RP_ID: z.string(),
});

const validEnvironmentVariables = environmentVariablesSchema.parse({
  ENV_NAME: process.env.ENV_NAME,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  AWS_SECRETS_COOKIE_ENCRYPTION_KEY:
    process.env.AWS_SECRETS_COOKIE_ENCRYPTION_KEY,
  RP_ID: process.env.RP_ID,
});

export type EnvName = z.infer<typeof envNameSchema>;

export const getSecret = async (secretName: string): Promise<string> => {
  const client = new SecretsManagerClient({});

  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);

  if (response.SecretString == null) {
    throw new Error('not found secretManger');
  }

  return response.SecretString;
};

const isAWSLambda = () => {
  if (process.env.AWS_LAMBDA_RUNTIME_API != null) {
    return true;
  }
  return false;
};

const secretsSchema = z.object({
  encryptionKey: z.string(),
});

const variablesSchema = z.object({
  cookieDomain: z.string(),
  corsOrigin: z.string(),
  rpId: z.string(),
});

type Secrets = z.infer<typeof secretsSchema>;
type Variables = z.infer<typeof variablesSchema>;

const getAWSSecrets = async (): Promise<Secrets> => {
  const encryptionKey = await getSecret(
    validEnvironmentVariables.AWS_SECRETS_COOKIE_ENCRYPTION_KEY
  );

  return {
    encryptionKey,
  };
};

export const getSecrets = async (): Promise<Secrets> => {
  const secrets = await getAWSSecrets();

  const validSecrets = secretsSchema.parse({
    encryptionKey: secrets.encryptionKey,
  });

  return validSecrets;
};

export const getVariables = (): Variables => {
  const cookieDomain = isAWSLambda()
    ? validEnvironmentVariables.COOKIE_DOMAIN
    : 'localhost';

  const corsOrigin = isAWSLambda()
    ? validEnvironmentVariables.CORS_ORIGIN
    : 'http://localhost:3000';

  const rpId = isAWSLambda() ? validEnvironmentVariables.RP_ID : 'localhost';

  const validVariables = variablesSchema.parse({
    cookieDomain: cookieDomain,
    corsOrigin: corsOrigin,
    rpId: rpId,
  });

  return validVariables;
};

export const getVariablesAndSecrets = async (): Promise<{
  envName: EnvName;
  secrets: Secrets;
  variables: Variables;
}> => {
  const envName = validEnvironmentVariables.ENV_NAME;

  if (!isEnvName(envName)) {
    throw new Error(`validatedEnvError: ${envName}`);
  }

  const secrets = await getSecrets();
  const variables = getVariables();

  return {
    envName: envName,
    secrets: secrets,
    variables: variables,
  };
};

export const isEnvName = (value: unknown): value is EnvName => {
  envNameSchema.parse(value);

  return true;
};
