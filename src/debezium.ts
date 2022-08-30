import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import { createHash } from 'crypto';
import { createServiceAccountAndGrantRoles } from './serviceAccount';
import { Input, Output, ProviderResource } from '@pulumi/pulumi';
import * as pulumi from '@pulumi/pulumi';
import { input as inputs } from '@pulumi/kubernetes/types';

type OptionalArgs = {
  diskType?: Input<string>;
  diskSize?: Input<number>;
  limits?: Input<{ cpu: string; memory: string }>;
  env?: pulumi.Input<inputs.core.v1.EnvVar>[];
  image?: string;
  resourcePrefix?: string;
  provider?: ProviderResource;
};

export function deployDebeziumToKubernetes(
  name: string,
  namespace: string | Input<string>,
  debeziumTopic: gcp.pubsub.Topic,
  debeziumPropsString: Output<string>,
  diskZone: Input<string>,
  {
    diskType = 'pd-ssd',
    diskSize = 10,
    limits = {
      cpu: '1',
      memory: '1024Mi',
    },
    env = [],
    image = 'debezium/server:1.5',
    resourcePrefix = '',
    provider,
  }: OptionalArgs = {},
): void {
  const { serviceAccount: debeziumSa } = createServiceAccountAndGrantRoles(
    `${resourcePrefix}debezium-sa`,
    `${name}-debezium`,
    `${name}-debezium`,
    [
      { name: 'publisher', role: 'roles/pubsub.publisher' },
      { name: 'viewer', role: 'roles/pubsub.viewer' },
    ],
  );

  const debeziumKey = new gcp.serviceaccount.Key(
    `${resourcePrefix}debezium-sa-key`,
    {
      serviceAccountId: debeziumSa.accountId,
    },
  );

  const debeziumSecretSa = new k8s.core.v1.Secret(
    `${resourcePrefix}debezium-secret-sa`,
    {
      metadata: {
        name: `${name}-debezium-sa`,
        namespace,
      },
      data: {
        'key.json': debeziumKey.privateKey,
      },
    },
    { provider },
  );

  // const debeziumTopic = new gcp.pubsub.Topic('debezium-topic', {
  //   name: debeziumTopicName,
  // });

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

  const disk = new gcp.compute.Disk(`${resourcePrefix}debezium-disk`, {
    name: `${name}-debezium-pv`,
    size: diskSize,
    zone: diskZone,
    type: diskType,
  });

  new k8s.core.v1.PersistentVolume(
    `${resourcePrefix}debezium-pv`,
    {
      metadata: {
        name: `${name}-debezium-pv`,
        namespace,
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        capacity: { storage: `${diskSize}Gi` },
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
    { provider },
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
        resources: { requests: { storage: `${diskSize}Gi` } },
        volumeName: `${name}-debezium-pv`,
      },
    },
    { provider },
  );

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
            volumes: [
              {
                name: 'service-account-key',
                secret: {
                  secretName: debeziumSecretSa.metadata.name,
                },
              },
              {
                name: 'props',
                secret: {
                  secretName: debeziumProps.metadata.name,
                },
              },
              {
                name: 'storage',
                persistentVolumeClaim: {
                  // Must not depend on the PVC variable because it causes deadlock
                  claimName: `${name}-debezium-pvc`,
                },
              },
            ],
            initContainers: [
              {
                name: 'data-ownership',
                image: 'alpine:3',
                command: ['chmod', '777', '/debezium/data'],
                volumeMounts: [
                  { name: 'storage', mountPath: '/debezium/data' },
                ],
              },
            ],
            containers: [
              {
                name: 'debezium',
                image,
                ports: [{ name: 'http', containerPort: 8080, protocol: 'TCP' }],
                volumeMounts: [
                  { name: 'props', mountPath: '/debezium/conf' },
                  { name: 'storage', mountPath: '/debezium/data' },
                  {
                    name: 'service-account-key',
                    mountPath: '/var/secrets/google',
                  },
                ],
                env: [
                  {
                    name: 'GOOGLE_APPLICATION_CREDENTIALS',
                    value: '/var/secrets/google/key.json',
                  },
                  ...env,
                ],
                resources: {
                  limits,
                  requests: limits,
                },
                livenessProbe: {
                  httpGet: { path: '/q/health', port: 'http' },
                  initialDelaySeconds: 60,
                  periodSeconds: 30,
                },
              },
            ],
          },
        },
      },
    },
    { dependsOn: [debeziumTopic], provider },
  );
}
