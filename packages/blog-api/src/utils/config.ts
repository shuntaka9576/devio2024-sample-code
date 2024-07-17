import * as z from 'zod';
import { envNameSchema, getVariablesAndSecrets } from './env';

const configSchema = z.object({
  auth: z.object({
    rpID: z.string(),
    rpName: z.string(),
  }),
  envName: envNameSchema,
  corsOrigin: z.string(),
  cookie: z.object({
    encryptionKey: z.string(),
    fields: z.object({ domain: z.string() }),
  }),
});

type Config = z.infer<typeof configSchema>;

const getConfig = async (): Promise<Config> => {
  const secretsAndVariables = await getVariablesAndSecrets();
  const parseResult = configSchema.safeParse({
    auth: {
      rpID: secretsAndVariables.variables.rpId,
      rpName: secretsAndVariables.variables.cookieDomain,
    },
    envName: secretsAndVariables.envName,
    corsOrigin: secretsAndVariables.variables.corsOrigin,
    cookie: {
      encryptionKey: secretsAndVariables.secrets.encryptionKey,
      fields: {
        domain: secretsAndVariables.variables.cookieDomain,
      },
    },
  });

  if (!parseResult.success) {
    throw new Error(
      `validatedConfigError: ${JSON.stringify(parseResult.error)}`
    );
  }

  return parseResult.data;
};

export const config = await getConfig();
