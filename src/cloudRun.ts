import { Input, Output, StackReference } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { location } from './config';
import { cloudrun } from '@pulumi/gcp/types/input';
import ServiceTemplateSpecContainerEnv = cloudrun.ServiceTemplateSpecContainerEnv;
import { Resource } from '@pulumi/pulumi/resource';
import { serviceAccountToMember } from './serviceAccount';

export function getCloudRunPubSubInvoker(
  infra: StackReference,
): Output<gcp.serviceaccount.Account> {
  return infra.getOutput(
    'cloudRunPubSubInvoker',
  ) as Output<gcp.serviceaccount.Account>;
}

export enum CloudRunAccess {
  Public = 1,
  PubSub,
}

export function createCloudRunService(
  name: string,
  image: string,
  envs: Input<Input<ServiceTemplateSpecContainerEnv>[]>,
  limits: Input<{ [key: string]: Input<string> }>,
  vpcConnector: gcp.vpcaccess.Connector | Output<gcp.vpcaccess.Connector>,
  serviceAccount:
    | gcp.serviceaccount.Account
    | Output<gcp.serviceaccount.Account>,
  opts?: {
    minScale?: number;
    concurrency?: number;
    dependsOn?: Input<Input<Resource>[]>;
    access?: CloudRunAccess;
    iamMemberName?: string;
    args?: Input<Input<string>[]>;
    annotations?: Record<string, string | Output<string>>;
    ingress?: 'all' | 'internal' | 'internal-and-cloud-load-balancing';
    infra: StackReference;
  },
): gcp.cloudrun.Service {
  const additionalAnnotations: Record<string, string | Output<string>> =
    opts?.annotations ?? {};
  if (opts?.minScale) {
    additionalAnnotations['autoscaling.knative.dev/minScale'] =
      opts.minScale.toString();
  }
  if (opts?.ingress) {
    additionalAnnotations['run.googleapis.com/ingress'] = opts.ingress;
  }
  const service = new gcp.cloudrun.Service(
    name,
    {
      name,
      autogenerateRevisionName: true,
      location,
      traffics: [{ latestRevision: true, percent: 100 }],
      template: {
        metadata: {
          annotations: {
            'run.googleapis.com/vpc-access-connector': vpcConnector.name,
            'run.googleapis.com/vpc-access-egress': 'private-ranges-only',
            ...additionalAnnotations,
          },
        },
        spec: {
          serviceAccountName: serviceAccount.email,
          containers: [
            {
              image,
              resources: { limits },
              envs,
              args: opts?.args,
            },
          ],
          containerConcurrency: opts?.concurrency,
        },
      },
    },
    { dependsOn: opts?.dependsOn },
  );
  if (opts?.access && opts?.iamMemberName) {
    const member =
      opts.access === CloudRunAccess.Public
        ? 'allUsers'
        : serviceAccountToMember(getCloudRunPubSubInvoker(opts.infra));
    new gcp.cloudrun.IamMember(opts.iamMemberName, {
      service: service.name,
      location,
      role: 'roles/run.invoker',
      member,
    });
  }
  return service;
}
