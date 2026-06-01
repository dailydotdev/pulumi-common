import {
  all,
  type Input,
  type Output,
  type ResourceTransform,
} from '@pulumi/pulumi';

import {
  type Affinity,
  type Image,
  type PriorityClassInput,
  type Resources,
  type Tolerations,
} from '../../kubernetes';
import { type AdhocEnv } from '../../utils';

/**
 * Default modules to load in the Redis configuration.
 */
export const defaultModules = [
  '/opt/redis-stack/lib/redisearch.so',
  '/opt/redis-stack/lib/rejson.so',
];

export const defaultImage = {
  repository: 'redis/redis-stack-server',
  tag: '7.2.0-v19',
};

export type CommonK8sRedisArgs = Partial<AdhocEnv & PriorityClassInput> & {
  memorySizeGb: Input<number>;
  maxMemoryPercentage?: Input<number>;
  storageSizeGb?: Input<number>;
  cpuSize?: Input<number | string>;
  namespace: Input<string>;
  replicas?: Input<number>;
  image?: Input<Image>;
  authKey?: Input<string>;
  timeout?: Input<number>;
  safeToEvict?: Input<boolean>;
  /**
   * Termination grace period (in seconds) for the Redis pods. On SIGTERM Redis
   * flushes its AOF/RDB before exiting; if the grace period is too short the
   * kubelet sends SIGKILL mid-write, which truncates the append-only file and
   * leaves the pod in CrashLoopBackOff on reschedule. Raising this gives Redis
   * room to shut down cleanly during node drains/upgrades.
   *
   * Defaults to the chart default (30s) when left unset.
   */
  terminationGracePeriodSeconds?: Input<number>;

  modules?: Input<string[]>;
  configuration?: Input<Record<string, string> | string>;
  disableCommands?: Input<string[]>;

  persistence?: Input<{
    enabled?: Input<boolean>;
    [key: string]: unknown;
  }>;

  metrics?: Input<{
    enabled?: Input<boolean>;
    image?: Input<Image>;
    resources?: Input<Partial<Resources>>;
    [key: string]: unknown;
  }>;

  tolerations?: {
    master?: Input<Tolerations[]>;
    replicas?: Input<Tolerations[]>;
  };
  affinity?: {
    master?: Input<Affinity>;
    replicas?: Input<Affinity>;
  };
};

export const configureConfiguration = (
  args: Pick<
    CommonK8sRedisArgs,
    'modules' | 'configuration' | 'memorySizeGb' | 'maxMemoryPercentage'
  >,
) => {
  return all([
    args.modules,
    args.configuration,
    args.memorySizeGb,
    args.maxMemoryPercentage,
  ]).apply(
    ([
      modules = defaultModules,
      configuration = {},
      memorySizeGb,
      maxMemoryPercentage = 80,
    ]) => {
      const hasLoadmoduleKey = Object.keys(configuration).some(
        (k) => k.trim().toLowerCase() === 'loadmodule',
      );

      const hasMaxmemoryKey = Object.keys(configuration).some(
        (k) => k.trim().toLowerCase() === 'maxmemory',
      );

      if (hasLoadmoduleKey) {
        throw new Error(
          'Invalid configuration: "loadmodule" must be provided via `modules`, not `configuration`.',
        );
      }

      const configurationLines = [
        ...Object.entries(configuration).map(
          ([key, value]) => `${key} ${value}`,
        ),
        ...modules.map((m) => `loadmodule ${m}`),
      ];

      if (!hasMaxmemoryKey && maxMemoryPercentage && memorySizeGb) {
        const maxMemory = Math.floor(
          memorySizeGb * 1024 * (maxMemoryPercentage / 100),
        );

        configurationLines.push(`maxmemory ${maxMemory}mb`);
      }

      return configurationLines.join('\n');
    },
  );
};

export const configurePersistence = (
  args: Pick<
    CommonK8sRedisArgs,
    'memorySizeGb' | 'storageSizeGb' | 'persistence'
  >,
) => {
  return all([args.memorySizeGb, args.storageSizeGb, args.persistence]).apply(
    ([memorySizeGb, storageSizeGb, persistence]) => {
      const defaultStorageSize = Math.max(10, memorySizeGb * 2);
      const storageSize = storageSizeGb || defaultStorageSize;
      if (memorySizeGb > storageSize) {
        throw new Error('Storage size must be greater than memory size');
      }

      return {
        storageClass: 'hyperdisk-balanced',
        ...persistence,
        size: `${storageSize}Gi`,
      };
    },
  );
};

export const configureResources = (
  args: Pick<CommonK8sRedisArgs, 'cpuSize' | 'memorySizeGb' | 'isAdhocEnv'>,
): Output<Partial<Resources> | undefined> => {
  return all([args.isAdhocEnv, args.cpuSize, args.memorySizeGb]).apply(
    ([isAdhocEnv, cpuSize, memorySizeGb]) => {
      return isAdhocEnv
        ? undefined
        : {
            requests: {
              cpu: cpuSize?.toString() || '1000m',
              memory: `${memorySizeGb}Gi`,
            },
            limits: {
              memory: `${Math.round(memorySizeGb * 1024 * 1.1)}Mi`,
            },
          };
    },
  );
};

export const configureSidecarResources = (
  resources?: Input<Partial<Resources>>,
): Output<Partial<Resources>> =>
  all([resources]).apply(([resources]) => ({
    requests: {
      cpu: resources?.requests?.cpu ?? '50m',
      memory: resources?.requests?.memory ?? '32Mi',
      'ephemeral-storage': resources?.requests?.['ephemeral-storage'] ?? '50Mi',
    },
    limits: {
      memory: resources?.limits?.memory ?? '100Mi',
      'ephemeral-storage': resources?.limits?.['ephemeral-storage'] ?? '2Gi',
    },
  }));

export const configurePriorityClass = (
  args: Pick<
    CommonK8sRedisArgs,
    'isAdhocEnv' | 'priorityClass' | 'priorityClassName'
  >,
) => {
  return all([
    args.isAdhocEnv,
    args.priorityClass,
    args.priorityClassName,
  ]).apply(([isAdhocEnv, priorityClass, priorityClassName]) => {
    if (isAdhocEnv) {
      return undefined;
    }
    return priorityClass ? priorityClass.name : priorityClassName;
  });
};

/**
 * Builds a resource transform that sets `terminationGracePeriodSeconds` on every
 * StatefulSet rendered by a Helm chart. Use this for charts (e.g. bitnami
 * `redis-cluster`) that do not expose the grace period as a value, so it cannot
 * be configured through `values` alone.
 */
export const configureTerminationGracePeriod = (
  terminationGracePeriodSeconds: Input<number>,
): ResourceTransform => {
  return (args) => {
    if (args.type !== 'kubernetes:apps/v1:StatefulSet') {
      return undefined;
    }
    const props = args.props;
    props.spec ??= {};
    props.spec.template ??= {};
    props.spec.template.spec ??= {};
    props.spec.template.spec.terminationGracePeriodSeconds =
      terminationGracePeriodSeconds;
    return { props, opts: args.opts };
  };
};
