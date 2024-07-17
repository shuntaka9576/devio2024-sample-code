import * as cdk from 'aws-cdk-lib';
import { getConfig } from '../lib/config';
import { BlogApiStack } from '../lib/stacks/blog-api-stack';
import { CertificationStack } from '../lib/stacks/certification-stack';
import { Route53Stack } from '../lib/stacks/route53-stack';

const app = new cdk.App();

const envName = app.node.tryGetContext('envName');
const config = getConfig(envName);

const route53Stack = new Route53Stack(
  app,
  `${config.envName}-${config.projectName}-route53`,
  {
    projectName: config.projectName,
    envName: config.envName,
    domainName: config.domainName,
    env: {
      region: 'us-east-1',
      account: config.cdKDefaultAccount,
    },
  }
);

const certificationStack = new CertificationStack(
  app,
  `${config.envName}-${config.projectName}-certification`,
  {
    projectName: config.projectName,
    envName: config.envName,
    domainName: config.domainName,
    shuntakaHostedZone: route53Stack.shuntakaHostedZone,
    env: {
      region: 'us-east-1',
      account: config.cdKDefaultAccount,
    },
    crossRegionReferences: true,
  }
);

new BlogApiStack(app, `${config.envName}-${config.projectName}-blog-api`, {
  projectName: config.projectName,
  envName: config.envName,
  domainName: config.domainName,
  awsSecretsCookieEncryptionKey: config.awsSecretsCookieEncryptionKey,
  shuntakaHostedZone: route53Stack.shuntakaHostedZone,
  blogApiCertificate: certificationStack.blogApiCertificate,
  env: {
    region: 'ap-northeast-1',
    account: config.cdKDefaultAccount,
  },
  crossRegionReferences: true,
});
