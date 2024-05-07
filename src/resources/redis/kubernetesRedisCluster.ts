import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { urnPrefix } from '../../constants';
import {
  CommonK8sRedisArgs,
  commonConfiguration,
  configurePersistence,
  configureResources,
  defaultImage,
} from './common';
import { charts } from '../../kubernetes';

export type K8sRedisClusterArgs = CommonK8sRedisArgs & {
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
