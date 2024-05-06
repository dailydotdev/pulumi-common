import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { urnPrefix } from '../../constants';

import { charts } from '../../kubernetes';
import {
  CommonK8sRedisArgs,
  commonConfiguration,
  configurePersistence,
  configureResources,
  defaultImage,
} from './common';

export type K8sRedisArgs = CommonK8sRedisArgs & {
  architecture?: pulumi.Input<'standalone' | 'replication'>;
};

export class KubernetesRedis extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: K8sRedisArgs,
    resourceOptions?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:KubernetesRedis`, name, args, resourceOptions);

    const redisInstance = {
      persistence: configurePersistence({
        memorySizeGb: args.memorySizeGb,
        storageSizeGb: args.storageSizeGb,
        persistence: args.persistence,
      }),
      resources: configureResources({
        isAdhocEnv: args.isAdhocEnv,
        memorySizeGb: args.memorySizeGb,
        cpuSize: args.cpuSize,
      }),
    };

    new k8s.helm.v3.Release(
      name,
      {
        ...charts['redis'],
        namespace: args.namespace,
        createNamespace: false,
        atomic: true,
        timeout: args.timeout,
        values: {
          fullnameOverride: name,
          commonConfiguration: commonConfiguration,
          image: pulumi.all([args.image]).apply(([image]) => ({
            repository: image?.repository || defaultImage.repository,
            tag: image?.tag || defaultImage.tag,
          })),
          metrics: pulumi.all([args.metrics]).apply(([metrics]) => ({
            ...metrics,
            enabled: metrics?.enabled ?? true,
            resourcesPreset: 'micro',
          })),

          // Values specific to master-slave setup
          architecture: args.architecture || 'replication',
          auth: {
            enabled: !!args.authKey,
            password: args.authKey,
          },
          master: pulumi
            .all([args.affinity, args.tolerations])
            .apply(([affinity, tolerations]) => ({
              ...redisInstance,
              affinity: affinity?.master,
              tolerations: tolerations?.master,
            })),
          replica: pulumi
            .all([args.affinity, args.tolerations])
            .apply(([affinity, tolerations]) => ({
              ...redisInstance,
              replicaCount: args.replicas || 3,
              affinity: affinity?.replicas,
              tolerations: tolerations?.replicas,
            })),
        },
      },
      resourceOptions,
    );
  }
}
