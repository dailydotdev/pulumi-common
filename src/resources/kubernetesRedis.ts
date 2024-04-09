import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { urnPrefix } from '../constants';
import { AdhocEnv } from '../utils';

type Image = {
  repository: pulumi.Input<string>;
  tag: pulumi.Input<string>;
};

type Tolerations = {
  key: pulumi.Input<string>;
  value: pulumi.Input<string>;
  operator: pulumi.Input<'Exists' | 'Equal'>;
  effect: pulumi.Input<'NoExecute' | 'NoSchedule' | 'PreferNoSchedule'>;
};

type NodeAffinity = {
  type: pulumi.Input<'soft' | 'hard'>;
  key: pulumi.Input<string>;
  values: pulumi.Input<string[]>;
};

export type K8sRedisArgs = AdhocEnv & {
  replicas: pulumi.Input<number>;
  memorySizeGb: pulumi.Input<number>;
  cpuSize?: pulumi.Input<number | string>;
  namespace: pulumi.Input<string>;
  architecture?: pulumi.Input<'standalone' | 'replication'>;
  image?: Image;
  persistence?: pulumi.Input<{
    enabled?: pulumi.Input<boolean>;
    [key: string]: unknown;
  }>;
  tolerations?: pulumi.Input<{
    master?: Tolerations;
    replicas?: Tolerations;
  }>;
  nodeSelector?: pulumi.Input<{
    master?: NodeAffinity;
    replicas?: NodeAffinity;
  }>;
  authKey?: pulumi.Input<string>;
  metrics?: pulumi.Input<boolean>;
};

const commonConfiguration = `
loadmodule /opt/redis-stack/lib/redisearch.so
loadmodule /opt/redis-stack/lib/rejson.so
`;

const defaultImage = {
  repository: 'redis/redis-stack-server',
  tag: '7.2.0-v10',
};

const chartVersion = '19.0.2';

export class KubernetesRedis extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: K8sRedisArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:KubernetesRedis`, name, args, opts);

    // const tolerations = args.tolerations || [];
    const persistence = {
      storageClass: 'standard-rwo',
      ...args.persistence,
      size: pulumi
        .all([args.memorySizeGb])
        // Set persistence size to 2x memory size, with a minimum of 10Gi (Google Cloud's minimum persistent disk size)
        .apply(([memorySizeGb]) => `${Math.max(10, memorySizeGb * 2)}Gi`),
    };

    const resources = args.isAdhocEnv
      ? undefined
      : {
          requests: {
            cpu: args.cpuSize || '1000m',
            memory: `${args.memorySizeGb}Gi`,
          },
          limits: {
            memory: pulumi.all([args.memorySizeGb]).apply(
              // Set memory limit to 10% more than requested memory
              ([memorySizeGb]) => `${Math.round(memorySizeGb * 1024 * 1.1)}Mi`,
            ),
          },
        };

    const redisInstance = {
      persistence,
      resources,
    };

    const auth = {
      enabled: !!args.authKey,
      password: args.authKey,
    };

    new k8s.helm.v3.Release(name, {
      chart: 'redis',
      version: chartVersion,
      namespace: args.namespace,
      repositoryOpts: {
        repo: 'https://charts.bitnami.com/bitnami',
      },
      createNamespace: false,
      atomic: true,
      values: {
        fullnameOverride: name,
        image: {
          repository: args.image?.repository || defaultImage.repository,
          tag: args.image?.tag || defaultImage.tag,
        },
        architecture: args.architecture || 'replication',
        commonConfiguration,
        auth,
        metrics: args.metrics ?? true,
        master: pulumi
          .all([args.nodeSelector, args.tolerations])
          .apply(([nodeSelector, tolerations]) => ({
            ...redisInstance,
            nodeAffinityPreset: nodeSelector?.master,
            tolerations: tolerations?.master,
          })),
        replica: pulumi
          .all([args.nodeSelector, args.tolerations])
          .apply(([nodeSelector, tolerations]) => ({
            ...redisInstance,
            replicaCount: args.replicas || 3,
            nodeAffinityPreset: nodeSelector?.replicas,
            tolerations: tolerations?.replicas,
          })),
      },
    });
  }
}
