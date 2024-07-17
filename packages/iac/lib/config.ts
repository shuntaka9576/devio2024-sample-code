import * as z from 'zod';

export const envNameSchema = z.union([z.literal('dev'), z.literal('prd')]);
export type EnvName = z.infer<typeof envNameSchema>;

const commonVariables = {
  projectName: 'shuntaka-dev',
};

const envNameVariables: {
  [key in EnvName]: {
    awsSecretsCookieEncryptionKey: string;
    domainName: string;
  };
} = {
  dev: {
    domainName: 'hoge.site',
    awsSecretsCookieEncryptionKey:
      '/dev/shuntaka-dev/blog-api/cookie-encryption-key',
  },
  prd: {
    domainName: 'hoge.jp',
    awsSecretsCookieEncryptionKey:
      '/prd/shuntaka-dev/blog-api/cookie-encryption-key',
  },
};

const configSchema = z.object({
  envName: envNameSchema,
  projectName: z.literal(commonVariables.projectName),
  domainName: z.string(),
  awsSecretsCookieEncryptionKey: z.string(),
  cdKDefaultAccount: z.string(),
});

type Config = z.infer<typeof configSchema>;

export const getConfig = (envName: unknown): Config => {
  if (!isEnvName(envName)) {
    throw new Error(`Not found environment key: ${envName}`);
  }

  const variables = envNameVariables[envName];

  const config: unknown = {
    envName: envName,
    projectName: commonVariables.projectName,
    awsSecretsCookieEncryptionKey: variables.awsSecretsCookieEncryptionKey,
    domainName: variables.domainName,
    cdKDefaultAccount: process.env.CDK_DEFAULT_ACCOUNT,
  };

  const validConfig = configSchema.parse(config);

  return validConfig;
};

export const isEnvName = (value: unknown): value is EnvName => {
  envNameSchema.parse(value);

  return true;
};
