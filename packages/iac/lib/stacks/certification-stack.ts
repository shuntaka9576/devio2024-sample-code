import {
  Stack,
  type StackProps,
  aws_certificatemanager,
  type aws_route53,
} from 'aws-cdk-lib';
import { pascalCase } from 'change-case';
import type { Construct } from 'constructs';
import type { EnvName } from '../config';

type Props = {
  projectName: string;
  envName: EnvName;
  domainName: string;
  shuntakaHostedZone: aws_route53.HostedZone;
} & StackProps;

export class CertificationStack extends Stack {
  blogApiCertificate: aws_certificatemanager.Certificate;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const stackPrefix = 'certification';
    const idPrefix = `${props.envName}-${props.projectName}-${stackPrefix}`;

    this.blogApiCertificate = new aws_certificatemanager.Certificate(
      this,
      pascalCase(`${idPrefix}ApiCertificate`),
      {
        domainName: `api.${props.domainName}`,
        validation: aws_certificatemanager.CertificateValidation.fromDns(
          props.shuntakaHostedZone
        ),
      }
    );
  }
}
