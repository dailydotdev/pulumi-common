import * as k8s from '@pulumi/kubernetes';
import { Input, Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { core } from '@pulumi/kubernetes/types/input';
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
