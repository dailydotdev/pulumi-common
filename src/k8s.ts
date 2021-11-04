import * as k8s from '@pulumi/kubernetes';
import { Input, Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { autoscaling, core } from '@pulumi/kubernetes/types/input';
import EnvVar = core.v1.EnvVar;

export function k8sServiceAccountToIdentity(
  serviceAccount: k8s.core.v1.ServiceAccount,
): Output<string> {
  return serviceAccount.metadata.apply(
    (metadata) =>
      `serviceAccount:${gcp.config.project}.svc.id.goog[${metadata.namespace}/${metadata.name}]`,
  );
}

export function createK8sServiceAccountFromGCPServiceAccount(
  resourceName: string,
  name: string,
  namespace: string,
  serviceAccount: gcp.serviceaccount.Account,
): k8s.core.v1.ServiceAccount {
  return new k8s.core.v1.ServiceAccount(resourceName, {
    metadata: {
      namespace,
      name,
      annotations: {
        'iam.gke.io/gcp-service-account': serviceAccount.email,
      },
    },
  });
}

export function createMigrationJob(
  name: string,
  namespace: string,
  image: string,
  args: string[],
  env: Input<Input<EnvVar>[]>,
  serviceAccount: k8s.core.v1.ServiceAccount,
): k8s.batch.v1.Job {
  return new k8s.batch.v1.Job(
    name,
    {
      metadata: {
        name,
        namespace,
      },
      spec: {
        completions: 1,
        template: {
          spec: {
            containers: [
              {
                name: 'app',
                image,
                args,
                env,
              },
            ],
            serviceAccountName: serviceAccount.metadata.name,
            restartPolicy: 'Never',
          },
        },
      },
    },
    { deleteBeforeReplace: true },
  );
}

export function getTargetRef(
  deployment: Input<string>,
): Input<autoscaling.v1.CrossVersionObjectReference> {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    name: deployment,
  };
}

export function createVerticalPodAutoscaler(
  name: string,
  metadata: Input<k8s.types.input.meta.v1.ObjectMeta>,
  targetRef: Input<autoscaling.v1.CrossVersionObjectReference>,
): k8s.apiextensions.CustomResource {
  return new k8s.apiextensions.CustomResource(name, {
    apiVersion: 'autoscaling.k8s.io/v1',
    kind: 'VerticalPodAutoscaler',
    metadata,
    spec: {
      targetRef,
      updatePolicy: {
        updateMode: 'Off',
      },
    },
  });
}

export const getFullSubscriptionLabel = (label: string): string =>
  `metadata.user_labels.${label}`;

export const getPubSubUndeliveredMessagesMetric = (): string =>
  'pubsub.googleapis.com|subscription|num_undelivered_messages';
