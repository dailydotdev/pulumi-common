import { helm } from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

import { urnPrefix } from '../../constants';
import { charts } from '../../kubernetes';
import {
  type CommonK8sRedisArgs,
  configureConfiguration,
  configurePersistence,
  configurePriorityClass,
  configureResources,
  configureSidecarResources,
} from './common';

export type K8sRedisClusterArgs = Omit<CommonK8sRedisArgs, 'authKey'> & {
  nodes: pulumi.Input<number>;
  password?: pulumi.Input<string>;
};

export class KubernetesRedisCluster extends pulumi.ComponentResource {
  public chart: helm.v4.Chart;

  constructor(
    name: string,
    args: K8sRedisClusterArgs,
    resourceOptions?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:KubernetesRedisCluster`, name, args, resourceOptions);

    this.chart = new helm.v4.Chart(
      name,
      {
        ...charts['redis-cluster'],
        namespace: args.namespace,
        values: {
          fullnameOverride: name,
          commonAnnotations: {
            'cluster-autoscaler.kubernetes.io/safe-to-evict':
              args?.safeToEvict?.valueOf() ?? 'false',
          },
          commonLabels: {
            'app.kubernetes.io/instance': name,
          },
          image: pulumi.all([args.image]).apply(([image]) => ({
            repository: image?.repository ?? 'daily-ops/bitnami-redis-cluster',
            registry: image?.registry ?? 'gcr.io',
            tag: image?.tag ?? '7.2.5-debian-12-r5',
          })),
          metrics: pulumi.all([args.metrics]).apply(([metrics]) => ({
            ...metrics,
            image: {
              repository:
                metrics?.image?.repository ??
                'daily-ops/bitnami-redis-exporter',
              registry: metrics?.image?.registry ?? 'gcr.io',
              tag: metrics?.image?.tag ?? '1.76.0-debian-12-r0',
            },
            enabled: metrics?.enabled ?? true,
            resources: configureSidecarResources(metrics?.resources),
          })),

          usePassword: !!args.password,
          password: args.password,
          cluster: {
            nodes: args.nodes,
            replicas: args.replicas,
          },
          redis: {
            resources: configureResources({
              isAdhocEnv: args.isAdhocEnv,
              memorySizeGb: args.memorySizeGb,
              cpuSize: args.cpuSize,
            }),
            affinity: args.affinity,
            tolerations: args.tolerations,
            priorityClassName: configurePriorityClass(args),
            configmap: configureConfiguration({
              modules: args.modules,
              configuration: args.configuration,
              memorySizeGb: args.memorySizeGb,
            }),
          },
          persistence: configurePersistence({
            memorySizeGb: args.memorySizeGb,
            storageSizeGb: args.storageSizeGb,
            persistence: args.persistence,
          }),
        },
      },
      resourceOptions,
    );
  }
}
