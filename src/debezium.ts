import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import { createHash } from 'crypto';
import { createServiceAccountAndGrantRoles } from './serviceAccount';
import { Input, Output } from '@pulumi/pulumi';

export function deployDebeziumToKubernetes(
  name: string,
  namespace: string | Input<string>,
  debeziumTopicName: Input<string>,
  debeziumPropsString: Output<string>,
): void {
  const { serviceAccount: debeziumSa } = createServiceAccountAndGrantRoles(
    'debezium-sa',
    `${name}-debezium`,
    `${name}-debezium`,
    [
      { name: 'publisher', role: 'roles/pubsub.publisher' },
      { name: 'viewer', role: 'roles/pubsub.viewer' },
    ],
  );

  const debeziumKey = new gcp.serviceaccount.Key('debezium-sa-key', {
    serviceAccountId: debeziumSa.accountId,
  });

  const debeziumSecretSa = new k8s.core.v1.Secret('debezium-secret-sa', {
    metadata: {
      name: `${name}-debezium-sa`,
      namespace,
    },
    data: {
      'key.json': debeziumKey.privateKey,
    },
  });

  const debeziumTopic = new gcp.pubsub.Topic('debezium-topic', {
    name: debeziumTopicName,
  });

  const propsHash = debeziumPropsString.apply((props) =>
    createHash('md5').update(props).digest('hex'),
  );

  const debeziumProps = new k8s.core.v1.Secret('debezium-props', {
    metadata: {
      name: `${name}-debezium-props`,
      namespace,
    },
    data: {
      'application.properties': debeziumPropsString.apply((str) =>
        Buffer.from(str).toString('base64'),
      ),
    },
  });

  const labels: Input<{
    [key: string]: Input<string>;
  }> = {
    parent: name,
    app: 'debezium',
  };

  new k8s.core.v1.PersistentVolumeClaim('debezium-pvc', {
    metadata: {
      name: `${name}-debezium-pvc`,
      namespace,
    },
    spec: {
      accessModes: ['ReadWriteOnce'],
      resources: { requests: { storage: '10Gi' } },
      storageClassName: 'retain-ssd',
    },
  });

  const limits: Input<{
    [key: string]: Input<string>;
  }> = {
    cpu: '0.5',
    memory: '512Mi',
  };

  new k8s.apps.v1.Deployment(
    'debezium-deployment',
    {
      metadata: {
        name: `${name}-debezium`,
        namespace,
      },
      spec: {
        replicas: 1,
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
                image: 'debezium/server:1.5',
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
    { dependsOn: [debeziumTopic] },
  );
}
