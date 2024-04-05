import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import { createHash } from 'crypto';
import { createServiceAccountAndGrantRoles } from './serviceAccount';
import { Input, Output, ProviderResource, interpolate } from '@pulumi/pulumi';
import * as pulumi from '@pulumi/pulumi';
import { input as inputs } from '@pulumi/kubernetes/types';
import { stripCpuFromLimits } from './utils';
import { PodResources } from './k8s';

type OptionalArgs = {
  diskType?: Input<string>;
  diskSize?: Input<number>;
  limits?: Input<PodResources>;
  env?: pulumi.Input<inputs.core.v1.EnvVar>[];
  image?: string;
  resourcePrefix?: string;
  provider?: ProviderResource;
  isAdhocEnv?: boolean;
  disableHealthCheck?: boolean;
};

const DEFAULT_DISK_SIZE = 10;

/**
 * Deploys only the shared dependencies for Debezium.
 * This includes disk and service account.
 */
export function deployDebeziumSharedDependencies(
  name: string,
  diskZone: Input<string>,
  {
    diskType = 'pd-ssd',
    diskSize = DEFAULT_DISK_SIZE,
    resourcePrefix = '',
    isAdhocEnv,
  }: Pick<
    OptionalArgs,
    'resourcePrefix' | 'diskSize' | 'diskType' | 'isAdhocEnv'
  > = {},
): {
  debeziumSa: gcp.serviceaccount.Account | undefined;
  debeziumKey: gcp.serviceaccount.Key | undefined;
  disk: gcp.compute.Disk | undefined;
} {
  if (isAdhocEnv) {
    return { debeziumKey: undefined, debeziumSa: undefined, disk: undefined };
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

  const disk = new gcp.compute.Disk(`${resourcePrefix}debezium-disk`, {
    name: `${name}-debezium-pv`,
    size: diskSize,
    zone: diskZone,
    type: diskType,
  });

  return { debeziumSa, debeziumKey, disk };
}

/**
 * Deploys only the Kubernetes resources for Debezium
 */
export function deployDebeziumKubernetesResources(
  name: string,
  namespace: string | Input<string>,
  debeziumPropsString: Output<string>,
  debeziumKey: gcp.serviceaccount.Key | undefined,
  disk: gcp.compute.Disk | undefined,
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
  }: Pick<
    OptionalArgs,
    | 'limits'
    | 'env'
    | 'image'
    | 'resourcePrefix'
    | 'provider'
    | 'isAdhocEnv'
    | 'disableHealthCheck'
  > = {},
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
  ];
  const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [
    { name: 'props', mountPath: '/debezium/conf' },
  ];

  const initContainers: k8s.types.input.core.v1.Container[] = [];

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

  // If external disk is provided
  if (disk) {
    new k8s.core.v1.PersistentVolume(
      `${resourcePrefix}debezium-pv`,
      {
        metadata: {
          name: `${name}-debezium-pv`,
          namespace,
        },
        spec: {
          accessModes: ['ReadWriteOnce'],
          capacity: { storage: interpolate`${disk.size}Gi` },
          claimRef: {
            name: `${name}-debezium-pvc`,
            namespace,
          },
          gcePersistentDisk: {
            pdName: disk.name,
            fsType: 'ext4',
          },
        },
      },
      { provider, ignoreChanges: ['spec.claimRef'] },
    );

    new k8s.core.v1.PersistentVolumeClaim(
      `${resourcePrefix}debezium-pvc`,
      {
        metadata: {
          name: `${name}-debezium-pvc`,
          namespace,
        },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: interpolate`${disk.size}Gi` } },
          volumeName: `${name}-debezium-pv`,
        },
      },
      { provider },
    );

    volumes.push({
      name: 'storage',
      persistentVolumeClaim: {
        // Must not depend on the PVC variable because it causes deadlock
        claimName: `${name}-debezium-pvc`,
      },
    });
    volumeMounts.push({ name: 'storage', mountPath: '/debezium/data' });
    initContainers.push({
      name: 'data-ownership',
      image: 'alpine:3',
      command: ['chmod', '777', '/debezium/data'],
      volumeMounts: [{ name: 'storage', mountPath: '/debezium/data' }],
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
          },
          spec: {
            nodeSelector: disk
              ? { 'topology.kubernetes.io/zone': disk.zone }
              : undefined,
            volumes,
            initContainers,
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

export function deployDebeziumWithDependencies(
  name: string,
  namespace: string | Input<string>,
  debeziumPropsString: Output<string>,
  diskZone: Input<string>,
  {
    diskType,
    diskSize,
    limits = {
      cpu: '1',
      memory: '1024Mi',
    },
    env = [],
    image = 'debezium/server:1.6',
    resourcePrefix = '',
    provider,
    isAdhocEnv,
    disableHealthCheck,
  }: OptionalArgs = {},
): void {
  const { debeziumKey, disk } = deployDebeziumSharedDependencies(
    name,
    diskZone,
    { diskType, diskSize, resourcePrefix, isAdhocEnv },
  );
  deployDebeziumKubernetesResources(
    name,
    namespace,
    debeziumPropsString,
    debeziumKey,
    disk,
    {
      limits,
      env,
      image,
      resourcePrefix,
      provider,
      isAdhocEnv,
      disableHealthCheck,
    },
  );
}
