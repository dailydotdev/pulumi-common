import { all, Input, Output } from '@pulumi/pulumi';

import { Affinity, Image, Tolerations } from '../../kubernetes';
import { AdhocEnv } from '../../utils';

/**
 * Common configuration for Redis instances.
 */
export const commonConfiguration = `
loadmodule /opt/redis-stack/lib/redisearch.so
loadmodule /opt/redis-stack/lib/rejson.so
`;

export const defaultImage = {
  repository: 'redis/redis-stack-server',
  tag: '7.2.0-v10',
};

export type CommonK8sRedisArgs = AdhocEnv & {
  memorySizeGb: Input<number>;
  cpuSize?: Input<number | string>;
  namespace: Input<string>;
  replicas: Input<number>;
  image?: Input<Image>;
  authKey?: Input<string>;

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

export const configurePersistence = (
  args: Pick<CommonK8sRedisArgs, 'memorySizeGb' | 'persistence'>,
) => {
  return all([args.memorySizeGb, args.persistence]).apply(
    ([memorySizeGb, persistence]) => {
      return {
        storageClass: 'standard-rwo',
        ...persistence,
        size: `${Math.max(10, memorySizeGb * 2)}Gi`,
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
