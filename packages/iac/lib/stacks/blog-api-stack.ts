import {
  Duration,
  Stack,
  type StackProps,
  aws_apigateway,
  type aws_certificatemanager,
  aws_dynamodb,
  aws_lambda,
  aws_lambda_nodejs,
  aws_route53,
  aws_route53_targets,
  aws_secretsmanager,
} from 'aws-cdk-lib';
import { AttributeType, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
import { pascalCase } from 'change-case';
import type { Construct } from 'constructs';
import type { EnvName } from '../config';

type Props = {
  projectName: string;
  envName: EnvName;
  domainName: string;
  awsSecretsCookieEncryptionKey: string;
  shuntakaHostedZone: aws_route53.HostedZone;
  blogApiCertificate: aws_certificatemanager.Certificate;
} & StackProps;

export class BlogApiStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);
    const stackPrefix = 'blog-api';
    const idPrefix = `${props.envName}-${props.projectName}-${stackPrefix}`;

    const cookieEncryptionSecret = new aws_secretsmanager.Secret(
      this,
      'CookieEncryptionSecret',
      {
        secretName: props.awsSecretsCookieEncryptionKey,
        generateSecretString: {
          passwordLength: 64,
          excludePunctuation: true,
        },
      }
    );

    const restApiLambdaName = `${idPrefix}-lambda`;
    const restApiLambda = new aws_lambda_nodejs.NodejsFunction(
      this,
      pascalCase(restApiLambdaName),
      {
        functionName: restApiLambdaName,
        runtime: aws_lambda.Runtime.NODEJS_20_X,
        architecture: aws_lambda.Architecture.ARM_64,
        entry: '../blog-api/src/utils/lunch/lunch-lambda.ts',
        bundling: {
          format: aws_lambda_nodejs.OutputFormat.ESM,
          nodeModules: ['@simplewebauthn/server', 'pino'],
        },
        tracing: aws_lambda.Tracing.ACTIVE,
        loggingFormat: aws_lambda.LoggingFormat.JSON,
        environment: {
          ENV_NAME: props.envName,
          CORS_ORIGIN: `https://${props.domainName}`,
          COOKIE_DOMAIN: props.domainName,
          AWS_SECRETS_COOKIE_ENCRYPTION_KEY: cookieEncryptionSecret.secretName,
          RP_ID: props.domainName,
        },
      }
    );
    cookieEncryptionSecret.grantRead(restApiLambda);

    const restApiName = `${idPrefix}-gateway`;
    const api = new aws_apigateway.LambdaRestApi(
      this,
      pascalCase(restApiName),
      {
        restApiName: restApiName,
        handler: restApiLambda,
        defaultCorsPreflightOptions: {
          allowOrigins: [`https://${props.domainName}`],
          allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowHeaders: aws_apigateway.Cors.DEFAULT_HEADERS,
          allowCredentials: true,
          maxAge: Duration.minutes(5),
        },
        deployOptions: {
          stageName: 'v1',
          tracingEnabled: true,
        },
      }
    );

    const domainName = new aws_apigateway.DomainName(
      this,
      pascalCase(`${restApiName}CustomDomain`),
      {
        domainName: `api.${props.domainName}`,
        certificate: props.blogApiCertificate,
        endpointType: aws_apigateway.EndpointType.EDGE,
      }
    );

    domainName.addBasePathMapping(api, { stage: api.deploymentStage });

    new aws_route53.ARecord(this, pascalCase(`${restApiName}AliasRecord`), {
      zone: props.shuntakaHostedZone,
      target: aws_route53.RecordTarget.fromAlias(
        new aws_route53_targets.ApiGatewayDomain(domainName)
      ),
      recordName: `api.${props.domainName}`,
    });

    const userTable = new aws_dynamodb.Table(
      this,
      pascalCase(`${idPrefix}UserTable`),
      {
        partitionKey: {
          name: 'userID',
          type: aws_dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: 'ID',
          type: aws_dynamodb.AttributeType.STRING,
        },
        tableName: `${props.envName}-User`,
        pointInTimeRecovery: true,
        billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      }
    );

    userTable.addGlobalSecondaryIndex({
      indexName: 'userNameIndex',
      partitionKey: {
        name: 'userName',
        type: AttributeType.STRING,
      },
      projectionType: ProjectionType.KEYS_ONLY,
    });

    userTable.grantReadWriteData(restApiLambda);
  }
}
