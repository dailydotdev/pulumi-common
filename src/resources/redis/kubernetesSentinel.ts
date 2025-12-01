import {
  all,
  ComponentResource,
  type CustomResourceOptions,
  type Input,
} from '@pulumi/pulumi';
import { urnPrefix } from '../../constants';
import { helm } from '@pulumi/kubernetes';

import {
  CommonK8sRedisArgs,
  configureConfiguration,
  configurePersistence,
  configurePriorityClass,
  configureResources,
  configureSidecarResources,
} from './common';
import { getSpotSettings, type Spot } from '../../k8s';
import { charts, type Image, type Resources } from '../../kubernetes';
import {
  KubernetesSentinelMonitor,
  type K8sRedisSentinelMonitorArgs,
} from './kubernetesSentinelMonitor';

export type K8sRedisSentinelArgs = Omit<
  CommonK8sRedisArgs,
  'configurationOld'
> & {
  spot?: Spot;
  monitor?: {
    enabled?: boolean;
    image?: K8sRedisSentinelMonitorArgs['image'];
    resources?: K8sRedisSentinelMonitorArgs['resources'];
  };
  sentinel?: {
    image?: Input<Image>;
    resources?: Input<Resources>;
  };
};

export class KubernetesSentinel extends ComponentResource {
  public chart: helm.v4.Chart;

  constructor(
    name: string,
    args: K8sRedisSentinelArgs,
    resourceOptions?: CustomResourceOptions,
  ) {
    super(`${urnPrefix}:KubernetesSentinel`, name, {}, resourceOptions);

    const commonLabels = {
      'app.kubernetes.io/instance': name,
    };

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
      resourcesPreset: args.isAdhocEnv ? 'none' : undefined,
      priorityClassName: configurePriorityClass(args),
    };

    this.chart = new helm.v4.Chart(
      name,
      {
        ...charts['redis-sentinel'],
        namespace: args.namespace,
        values: {
          global: {
            security: {
              allowInsecureImages: true,
            },
          },
          fullnameOverride: name,
          commonConfiguration: configureConfiguration({
            modules: args.modules,
            configuration: args.configuration,
            maxMemoryPercentage: args.maxMemoryPercentage,
            memorySizeGb: args.memorySizeGb,
          }),
          commonAnnotations: {
            'cluster-autoscaler.kubernetes.io/safe-to-evict':
              args?.safeToEvict?.valueOf() ?? 'false',
          },
          commonLabels: commonLabels,

          metrics: all([args.metrics]).apply(([metrics]) => ({
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
          sentinel: {
            enabled: true,
            automateClusterRecovery: true,
            downAfterMilliseconds: 2000,
            image: all([args.sentinel?.image]).apply(([image]) => ({
              repository:
                image?.repository ?? 'daily-ops/bitnami-redis-sentinel',
              registry: image?.registry ?? 'gcr.io',
              tag: image?.tag ?? '7.2.5-debian-12-r5',
            })),
            resources: configureSidecarResources(args.sentinel?.resources),
          },
          image: all([args.image]).apply(([image]) => ({
            repository: image?.repository ?? 'daily-ops/bitnami-redis',
            registry: image?.registry ?? 'gcr.io',
            tag: image?.tag ?? '7.2.5-debian-12-r6',
          })),
          auth: {
            enabled: !!args.authKey,
            password: args.authKey,
          },
          replica: all([args.spot, args.isAdhocEnv]).apply(
            ([spot, isAdhocEnv]) => {
              const { tolerations, affinity } = getSpotSettings(
                spot,
                isAdhocEnv,
              );
              return {
                ...redisInstance,
                replicaCount: args?.replicas,
                tolerations: tolerations,
                affinity: affinity,
                topologySpreadConstraints: [
                  {
                    maxSkew: 1,
                    topologyKey: 'kubernetes.io/hostname',
                    whenUnsatisfiable: 'ScheduleAnyway',
                    labelSelector: {
                      matchLabels: commonLabels,
                    },
                  },
                ],
              };
            },
          ),
        },
      },
      resourceOptions,
    );

    if (args.monitor?.enabled) {
      if (!args.authKey) {
        throw new Error(
          'authKey is required when monitor is enabled for KubernetesSentinel',
        );
      }
      new KubernetesSentinelMonitor(
        `${name}-monitor`,
        {
          isAdhocEnv: args.isAdhocEnv,
          namespace: args.namespace,
          image: args.monitor.image,
          resources: args.monitor.resources,
          sentinel: {
            name: name,
            namespace: args.namespace,
            authKey: args.authKey,
          },
        },
        {
          ...resourceOptions,
          parent: this,
          dependsOn: this.chart,
        },
      );
    }
  }
}
