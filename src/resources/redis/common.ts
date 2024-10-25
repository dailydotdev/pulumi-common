import { all, Input, Output } from '@pulumi/pulumi';

import {
  Affinity,
  Image,
  Tolerations,
  type PriorityClassInput,
} from '../../kubernetes';
import { AdhocEnv } from '../../utils';

/**
 * Default modules to load in the Redis configuration.
 */
export const defaultModules = [
  '/opt/redis-stack/lib/redisearch.so',
  '/opt/redis-stack/lib/rejson.so',
];

export const defaultImage = {
  repository: 'redis/redis-stack-server',
  tag: '7.2.0-v10',
};

export type CommonK8sRedisArgs = Partial<AdhocEnv & PriorityClassInput> & {
  memorySizeGb: Input<number>;
  storageSizeGb?: Input<number>;
  cpuSize?: Input<number | string>;
  namespace: Input<string>;
  replicas: Input<number>;
  image?: Input<Image>;
  authKey?: Input<string>;
  timeout?: Input<number>;
  safeToEvict?: Input<boolean>;

  modules?: Input<string[]>;
  configuration?: Input<string>;
  disableCommands?: Input<string[]>;

  persistence?: Input<{
    enabled?: Input<boolean>;
    [key: string]: unknown;
  }>;

  metrics?: Input<{
    enabled?: Input<boolean>;
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
  args: Pick<CommonK8sRedisArgs, 'modules' | 'configuration'>,
) => {
  return all([args.modules, args.configuration]).apply(
    ([modules = defaultModules, configuration = '']) => {
      let configurationString = configuration;
      modules.forEach((module) => {
        configurationString += `\nloadmodule ${module}`;
      });
      return configurationString;
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
        storageClass: 'standard-rwo',
        ...persistence,
        size: `${storageSize}Gi`,
      };
    },
  );
};

export const configureResources = (
  args: Pick<CommonK8sRedisArgs, 'cpuSize' | 'memorySizeGb' | 'isAdhocEnv'>,
): Output<
  | {
      requests: {
        cpu: string | number;
        memory: string;
      };
      limits: {
        memory: string;
      };
    }
  | undefined
> => {
  return all([args.isAdhocEnv, args.cpuSize, args.memorySizeGb]).apply(
    ([isAdhocEnv, cpuSize, memorySizeGb]) => {
      return isAdhocEnv
        ? undefined
        : {
            requests: {
              cpu: cpuSize || '1000m',
              memory: `${memorySizeGb}Gi`,
            },
            limits: {
              memory: `${Math.round(memorySizeGb * 1024 * 1.1)}Mi`,
            },
          };
    },
  );
};

export const configurePriorityClass = (
  args: CommonK8sRedisArgs,
): Output<string | undefined> => {
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
