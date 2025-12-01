import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { createHash } from 'crypto';
import { createServiceAccountAndGrantRoles } from './serviceAccount';
import { Input, Output, ProviderResource } from '@pulumi/pulumi';
import { PersistentVolumeClaim } from '@pulumi/kubernetes/core/v1';
import { input as inputs } from '@pulumi/kubernetes/types';
import { getSpotSettings } from './k8s';
import { configureResources, type Resources } from './kubernetes';

type OptionalArgs = {
  env?: pulumi.Input<inputs.core.v1.EnvVar>[];
  image?: string;
  resourcePrefix?: string;
  provider?: ProviderResource;
  isAdhocEnv?: boolean;
  disableHealthCheck?: boolean;
  affinity?: pulumi.Input<k8s.types.input.core.v1.Affinity>;
  version?: string;
};

/**
 * Deploys only the shared dependencies for Debezium.
 * This is the service account.
 */
export function deployDebeziumSharedDependencies({
  name,
  resourcePrefix = '',
  isAdhocEnv,
}: { name: string; namespace: string } & Pick<
  OptionalArgs,
  'resourcePrefix' | 'isAdhocEnv'
>): {
  debeziumSa?: gcp.serviceaccount.Account;
  debeziumKey?: gcp.serviceaccount.Key;
} {
  if (isAdhocEnv) {
    return {};
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

/**
 * Deploys only the Kubernetes resources for Debezium
 */
export function deployDebeziumKubernetesResources(
  name: string,
  namespace: string | Input<string>,
  debeziumPropsString: Output<string>,
  debeziumKey: gcp.serviceaccount.Key | undefined,
  resources: Resources,
  {
    env = [],
    image = 'debezium/server:1.6',
    resourcePrefix = '',
    provider,
    isAdhocEnv,
    disableHealthCheck,
    affinity,
    version,
  }: OptionalArgs = {},
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
      name: 'config',
      emptyDir: {},
    },
  ];
  const volumeMounts: k8s.types.input.core.v1.VolumeMount[] = [
    {
      name: 'config',
      mountPath: version?.startsWith('3')
        ? '/debezium/config'
        : '/debezium/conf',
    },
  ];

  const initContainers: k8s.types.input.core.v1.Container[] = [
    {
      name: 'copy-config',
      image,
      command: [
        'sh',
        '-c',
        `cp /props/application.properties /config/application.properties; cp -r /debezium/${version?.startsWith('3') ? 'config' : 'conf'}/* /config/`,
      ],
      volumeMounts: [
        { name: 'props', mountPath: '/props' },
        { name: 'config', mountPath: '/config' },
      ],
    },
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

  if (!isAdhocEnv) {
    const pvc = new PersistentVolumeClaim(
      `${resourcePrefix}debezium-pvc`,
      {
        metadata: {
          name: `${name}-debezium-data`,
          namespace,
          labels: { ...labels },
        },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: {
            requests: {
              storage: '4Gi',
            },
          },
          storageClassName: 'hyperdisk-balanced-retain',
        },
      },
      { provider, dependsOn: [] },
    );
    volumes.push({
      name: 'data',
      persistentVolumeClaim: {
        claimName: pvc.metadata.name,
      },
    });
    volumeMounts.push({ name: 'data', mountPath: '/debezium/data' });
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
          },
          spec: {
            volumes,
            initContainers,
            affinity: !isAdhocEnv ? affinity : undefined,
            tolerations,
            securityContext: {
              runAsUser: 185,
              runAsGroup: 185,
              fsGroup: 185,
            },
            containers: [
              {
                name: 'debezium',
                image,
                ports: [
                  { name: 'http', containerPort: 8080 },
                  { name: 'metrics', containerPort: 9404 },
                ],
                volumeMounts,
                env: [
                  {
                    name: 'GOOGLE_APPLICATION_CREDENTIALS',
                    value: '/var/secrets/google/key.json',
                  },
                  {
                    name: 'JMX_EXPORTER_PORT',
                    value: '9404',
                  },
                  ...env,
                ],
                resources: configureResources({
                  isAdhocEnv: !!isAdhocEnv,
                  resources,
                }),
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
