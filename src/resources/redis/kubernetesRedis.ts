import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { urnPrefix } from '../../constants';

import { charts } from '../../kubernetes';
import {
  CommonK8sRedisArgs,
  configureConfiguration,
  configurePersistence,
  configurePriorityClass,
  configureResources,
  defaultImage,
} from './common';
import { isNullOrUndefined } from '../../utils';

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
      disableCommands: args.disableCommands ?? [],
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
      priorityClassName: configurePriorityClass(args),
    };

    new k8s.helm.v3.Release(
      name,
      {
        ...charts['redis'],
        namespace: args.namespace,
        createNamespace: false,
        atomic: true,
        timeout: args.timeout,
        allowNullValues: true,
        values: {
          fullnameOverride: name,
          commonConfiguration: configureConfiguration({
            modules: args.modules,
            configuration: args.configuration,
          }),
          commonAnnotations: {
            'cluster-autoscaler.kubernetes.io/safe-to-evict':
              args?.safeToEvict?.valueOf() ?? 'false',
          },
          commonLabels: {
            'app.kubernetes.io/instance': name,
          },
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
              replicaCount: isNullOrUndefined(args.replicas)
                ? 3
                : args.replicas,
              affinity: affinity?.replicas,
              tolerations: tolerations?.replicas,
            })),
        },
      },
      resourceOptions,
    );
  }
}
