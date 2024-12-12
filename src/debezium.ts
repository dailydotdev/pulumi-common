import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import { createHash } from 'crypto';
import { createServiceAccountAndGrantRoles } from './serviceAccount';
import { Input, Output, ProviderResource } from '@pulumi/pulumi';
import * as pulumi from '@pulumi/pulumi';
import { input as inputs } from '@pulumi/kubernetes/types';
import { stripCpuFromLimits } from './utils';
import {
  getSpotSettings,
  k8sServiceAccountToWorkloadPrincipal,
  PodResources,
} from './k8s';

type OptionalArgs = {
  limits?: Input<PodResources>;
  env?: pulumi.Input<inputs.core.v1.EnvVar>[];
  image?: string;
  resourcePrefix?: string;
  provider?: ProviderResource;
  isAdhocEnv?: boolean;
  disableHealthCheck?: boolean;
  affinity?: pulumi.Input<k8s.types.input.core.v1.Affinity>;
};

/**
 * Deploys only the shared dependencies for Debezium.
 * This is the service account.
 */
export function deployDebeziumSharedDependencies(
  name: string,
  {
    resourcePrefix = '',
    isAdhocEnv,
  }: Pick<OptionalArgs, 'resourcePrefix' | 'isAdhocEnv'> = {},
): {
  debeziumSa: gcp.serviceaccount.Account | undefined;
  debeziumKey: gcp.serviceaccount.Key | undefined;
} {
  if (isAdhocEnv) {
    return { debeziumKey: undefined, debeziumSa: undefined };
  }

  const { serviceAccount: debeziumSa } = createServiceAccountAndGrantRoles(
    `${resourcePrefix}debezium-sa`,
    `${name}-debezium`,
    `${name}-debezium`,
    [
      { name: 'publisher', role: 'roles/pubsub.publisher' },
      { name: 'viewer', role: 'roles/pubsub.viewer' },
    ],
    isAdhocEnv,
  );

  const debeziumKey = new gcp.serviceaccount.Key(
    `${resourcePrefix}debezium-sa-key`,
    {
      serviceAccountId: debeziumSa?.accountId || '',
    },
  );

  return { debeziumSa, debeziumKey };
}

export const deployDebeziumSharedDependenciesV2 = (
  {
    name,
    namespace,
    isAdhocEnv = false,
    resourcePrefix,
  }: {
    name: string;
    namespace: string;
    isAdhocEnv?: boolean;
    resourcePrefix: string;
  },
  provider?: k8s.Provider,
): k8s.core.v1.ServiceAccount | undefined => {
  const serviceAccount = new k8s.core.v1.ServiceAccount(
    `${resourcePrefix}${name}-debezium-k8s-sa`,
    {
      metadata: {
        namespace,
        name: `${name}-debezium`,
      },
    },
    { provider },
  );

  if (!isAdhocEnv) {
    const bucket = new gcp.storage.Bucket(
      `${resourcePrefix}${name}-debezium-storage`,
      {
        name: `${name}-debezium-storage`,
        location: 'us',
        publicAccessPrevention: 'enforced',
        project: 'devkit-prod',
        forceDestroy: true,
        uniformBucketLevelAccess: true,
      },
    );

    const objectUsers = gcp.organizations.getIAMPolicy({
      bindings: [
        {
          role: 'roles/storage.objectUser',
          members: [
            k8sServiceAccountToWorkloadPrincipal(
              serviceAccount,
            ) as unknown as string,
          ],
        },
      ],
    });

    new gcp.storage.BucketIAMPolicy(
      `${resourcePrefix}${name}-debezium-storage-policy`,
      {
        bucket: bucket.name,
        policyData: objectUsers.then((objectUser) => objectUser.policyData),
      },
    );
  }

  return serviceAccount;
};

/**
 * Deploys only the Kubernetes resources for Debezium
 */
export function deployDebeziumKubernetesResources(
  name: string,
  namespace: string | Input<string>,
  debeziumPropsString: Output<string>,
  debeziumKey: gcp.serviceaccount.Key | undefined,
  {
    limits: requests = {
      cpu: '1',
      memory: '1024Mi',
    },
    env = [],
    image = 'debezium/server:1.6',
    resourcePrefix = '',
    provider,
    isAdhocEnv,
    disableHealthCheck,
    affinity,
    k8sServiceAccount,
  }: Pick<
    OptionalArgs,
    | 'limits'
    | 'env'
    | 'image'
    | 'resourcePrefix'
    | 'provider'
    | 'isAdhocEnv'
    | 'disableHealthCheck'
    | 'affinity'
  > & { k8sServiceAccount?: k8s.core.v1.ServiceAccount } = {},
): void {
  const propsHash = debeziumPropsString.apply((props) =>
    createHash('md5').update(props).digest('hex'),
  );

  const debeziumProps = new k8s.core.v1.Secret(
    `${resourcePrefix}debezium-props`,
    {
      metadata: {
        name: `${name}-debezium-props`,
        namespace,
      },
      data: {
        'application.properties': debeziumPropsString.apply((str) =>
          Buffer.from(str).toString('base64'),
        ),
      },
    },
    { provider },
  );

  const labels: Input<{
    [key: string]: Input<string>;
  }> = {
    parent: name,
    app: 'debezium',
  };

  const volumes: k8s.types.input.core.v1.Volume[] = [
    {
      name: 'props',
      secret: {
        secretName: debeziumProps.metadata.name,
      },
    },
    {
      name: 'data',
      csi: {
        driver: 'gcsfuse.csi.storage.gke.io',
        volumeAttributes: {
          bucketName: `${name}-debezium-storage`,
          mountOptions: 'implicit-dirs,uid=185,gid=0',
        },
      },
    },
  ];
  const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [
    { name: 'props', mountPath: '/debezium/conf' },
    { name: 'data', mountPath: '/debezium/data' },
  ];

  // If service account is provided
  if (debeziumKey) {
    const debeziumSecretSa = new k8s.core.v1.Secret(
      `${resourcePrefix}debezium-secret-sa`,
      {
        metadata: {
          name: `${name}-debezium-sa`,
          namespace,
        },
        data: {
          'key.json': debeziumKey?.privateKey || '',
        },
      },
      { provider },
    );
    volumes.push({
      name: 'service-account-key',
      secret: {
        secretName: debeziumSecretSa.metadata.name,
      },
    });
    volumeMounts.push({
      name: 'service-account-key',
      mountPath: '/var/secrets/google',
    });
  }

  let livenessProbe: k8s.types.input.core.v1.Probe | undefined;
  if (!disableHealthCheck) {
    livenessProbe = {
      httpGet: { path: '/q/health', port: 'http' },
      initialDelaySeconds: 60,
      periodSeconds: 30,
    };
  }

  const { tolerations } = getSpotSettings({ enabled: true }, isAdhocEnv);

  new k8s.apps.v1.Deployment(
    `${resourcePrefix}debezium-deployment`,
    {
      metadata: {
        name: `${name}-debezium`,
        namespace,
      },
      spec: {
        replicas: 1,
        strategy: {
          type: 'Recreate',
        },
        selector: { matchLabels: labels },
        template: {
          metadata: {
            labels: { ...labels, props: propsHash },
            annotations: {
              'gke-gcsfuse/volumes': 'true',
              'gke-gcsfuse/memory-limit': '128Mi',
              'gke-gcsfuse/cpu-request': '50m',
              'gke-gcsfuse/memory-request': '32Mi',
            },
          },
          spec: {
            volumes,
            affinity: !isAdhocEnv ? affinity : undefined,
            tolerations,
            serviceAccountName: k8sServiceAccount?.metadata.apply(
              (metadata) => metadata.name,
            ),
            containers: [
              {
                name: 'debezium',
                image,
                ports: [{ name: 'http', containerPort: 8080, protocol: 'TCP' }],
                volumeMounts,
                env: [
                  {
                    name: 'GOOGLE_APPLICATION_CREDENTIALS',
                    value: '/var/secrets/google/key.json',
                  },
                  ...env,
                ],
                resources: !isAdhocEnv
                  ? {
                      limits: stripCpuFromLimits(requests),
                      requests,
                    }
                  : undefined,
                livenessProbe,
              },
            ],
          },
        },
      },
    },
    { provider },
  );
}
