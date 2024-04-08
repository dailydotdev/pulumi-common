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
  namespace: pulumi.Input<string>;
  architecture?: pulumi.Input<'standalone' | 'replication'>;
  image?: Image;
  tolerations?: pulumi.Input<Tolerations>;
  persistence?: pulumi.Input<{
    enabled?: pulumi.Input<boolean>;
    [key: string]: unknown;
  }>;
  nodeSelector?: pulumi.Input<{
    master?: NodeAffinity;
    replicas?: NodeAffinity;
  }>;
  authKey?: pulumi.Input<string>;
};

const commonConfiguration = `
loadmodule /opt/redis-stack/lib/redisearch.so
loadmodule /opt/redis-stack/lib/rejson.so
`;

export class KubernetesRedis extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: K8sRedisArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:KubernetesRedis`, name, args, opts);

    const tolerations = args.tolerations || [];
    const persistence = {
      ...args.persistence,
      size: pulumi
        .all([args.memorySizeGb])
        // Set persistence size to 2x memory size
        .apply(([memorySizeGb]) => `${Math.max(memorySizeGb * 2)}Gi`),
    };

    const resources = args.isAdhocEnv
      ? undefined
      : {
          requests: {
            cpu: '1000m',
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
      tolerations,
      resources,
    };

    const auth = {
      enabled: !!args.authKey,
      password: args.authKey,
    };

    new k8s.helm.v3.Release(name, {
      chart: 'redis',
      version: '19.0.2',
      namespace: args.namespace,
      repositoryOpts: {
        repo: 'https://charts.bitnami.com/bitnami',
      },
      createNamespace: false,
      atomic: true,
      values: {
        fullnameOverride: name,
        image: {
          repository: args.image?.repository || 'redis/redis-stack-server',
          tag: args.image?.tag || '7.2.0-v10',
        },
        architecture: args.architecture || 'replication',
        commonConfiguration,
        auth,
        master: {
          ...redisInstance,
          nodeAffinityPreset: pulumi
            .all([args.nodeSelector])
            .apply(([nodeSelector]) => nodeSelector?.master),
        },
        replica: {
          ...redisInstance,
          replicaCount: args.replicas || 3,
          nodeAffinityPreset: pulumi
            .all([args.nodeSelector])
            .apply(([nodeSelector]) => nodeSelector?.replicas),
        },
      },
    });
  }
}
