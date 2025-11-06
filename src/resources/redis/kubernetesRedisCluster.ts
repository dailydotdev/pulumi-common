import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { urnPrefix } from '../../constants';
import {
  CommonK8sRedisArgs,
  configureConfiguration,
  configurePersistence,
  configurePriorityClass,
  configureResources,
} from './common';
import { charts } from '../../kubernetes';

export type K8sRedisClusterArgs = Omit<CommonK8sRedisArgs, 'image'> & {
  nodes: pulumi.Input<number>;
  password?: pulumi.Input<string>;
};

export class KubernetesRedisCluster extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: K8sRedisClusterArgs,
    resourceOptions?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:KubernetesRedisCluster`, name, args, resourceOptions);

    new k8s.helm.v3.Release(
      name,
      {
        ...charts['redis-cluster'],
        namespace: args.namespace,
        createNamespace: false,
        atomic: true,
        timeout: args.timeout,
        values: {
          fullnameOverride: name,
          commonConfiguration: configureConfiguration({
            modules: args.modules,
            configuration: args.configuration,
            memorySizeGb: args.memorySizeGb,
          }),
          commonAnnotations: {
            'cluster-autoscaler.kubernetes.io/safe-to-evict':
              args?.safeToEvict?.valueOf() ?? 'false',
          },
          commonLabels: {
            'app.kubernetes.io/instance': name,
          },
          image: {
            repository: 'daily-ops/bitnami-redis-cluster',
            registry: 'gcr.io',
            tag: '7.2.5-debian-12-r5',
          },
          metrics: pulumi.all([args.metrics]).apply(([metrics]) => ({
            ...metrics,
            image: {
              repository: 'daily-ops/bitnami-redis-exporter',
              registry: 'gcr.io',
              tag: '1.76.0-debian-12-r0',
            },
            enabled: metrics?.enabled ?? true,
            resourcesPreset: 'micro',
          })),

          usePassword: !!args.authKey,
          password: args.authKey,
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
