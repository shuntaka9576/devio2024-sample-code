import { Stack, type StackProps, aws_route53 } from 'aws-cdk-lib';
import { pascalCase } from 'change-case';
import type { Construct } from 'constructs';
import type { EnvName } from '../config';

type Props = {
  projectName: string;
  envName: EnvName;
  domainName: string;
} & StackProps;

export class Route53Stack extends Stack {
  shuntakaHostedZone: aws_route53.HostedZone;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const stackPrefix = 'route53';
    const idPrefix = `${props.envName}-${props.projectName}-${stackPrefix}`;

    this.shuntakaHostedZone = new aws_route53.PublicHostedZone(
      this,
      pascalCase(`${idPrefix}ShuntakaHostedZone`),
      {
        zoneName: props.domainName,
      }
    );
  }
}
