import { all, type Output } from '@pulumi/pulumi';

import { version } from '../../package.json';
import { type AdhocEnv } from '../utils';
import {
  type AutocertCertificate,
  type Image,
  type PodAnnotations,
  type Resources,
} from './types';

export const NodeLabelKeys = {
  Type: 'node.daily.dev/type',
  OptimizedRedis: 'node.daily.dev/optimized-redis',
  DiskType: 'node.daily.dev/disk-type',
  Spot: 'node.daily.dev/spot',
} as const;

export interface NodeLabel {
  key: (typeof NodeLabelKeys)[keyof typeof NodeLabelKeys];
  value: string;
}

/**
 * A set of common node labels used in the daily.dev infrastructure.
 *
 * Labels are used to identify nodes with specific characteristics, such as high memory or high CPU.
 * A deployment can then be configured to target nodes with specific labels, either just by the key or by the key and value.
 *
 * For more information on node labels, see https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/
 */
export const NodeLabels = {
  Spot: { key: NodeLabelKeys.Spot, value: 'true' },
  HighMem: { key: NodeLabelKeys.Type, value: 'highmem' },
  HighCPU: { key: NodeLabelKeys.Type, value: 'highcpu' },
  OptimizedRedisMaster: {
    key: NodeLabelKeys.OptimizedRedis,
    value: 'master',
  },
  OptimizedRedisReplica: {
    key: NodeLabelKeys.OptimizedRedis,
    value: 'replica',
  },
  PersistentDisk: {
    key: NodeLabelKeys.DiskType,
    value: 'persistent-disk',
  },
  HyperDisk: {
    key: NodeLabelKeys.DiskType,
    value: 'hyperdisk',
  },
} as const;

/**
 * Extracts the node labels from a single NodeLabel object, and returns them as a key-value pair.
 */
export const extractNodeLabels = (
  labels: NodeLabel | NodeLabel[],
): Record<string, string> => {
  if (Array.isArray(labels)) {
    return labels.reduce(
      (acc, curr) => ({ ...acc, ...extractNodeLabels(curr) }),
      {},
    );
  }
  return {
    [labels.key]: labels.value,
  };
};

/**
 * Common labels used in the daily.dev infrastructure.
 * These labels are used to identify resources created by pulumi, and of which version of the pulumi-common library was used to create them.
 */
export const commonLabels = {
  'app.kubernetes.io/managed-by': 'pulumi',
  'pulumi-common.daily.dev/version': version,
} as const;

/**
 * Returns the image string to be used in a Kubernetes deployment.
 * If a digest is provided, it will be used instead of the tag.
 */
export const image = ({ registry, repository, tag, digest }: Image) => {
  const separator = digest ? '@' : ':';
  return `${registry ? `${registry}/` : ''}${repository}${separator}${digest || tag}`;
};

export const configureResources = (
  args: AdhocEnv & {
    resources?: Resources;
  },
): Output<Partial<Resources>> | undefined => {
  if (args.isAdhocEnv || args.resources === undefined) {
    return undefined;
  }

  return all([args.resources]).apply(([resources]) => {
    return {
      requests: {
        cpu: resources?.requests?.cpu,
        memory: resources?.requests?.memory,
        'ephemeral-storage': resources?.requests?.['ephemeral-storage'],
      },
      limits: {
        memory: resources?.limits?.memory,
        'ephemeral-storage': resources?.limits?.['ephemeral-storage'],
      },
    };
  });
};

export const configureAutocertAnnotations = (
  certificate: AutocertCertificate,
): PodAnnotations => {
  if (!certificate || !certificate.enabled || !certificate.name) {
    return {};
  }

  const extraAnnotations: PodAnnotations = {
    'autocert.step.sm/name': certificate.name,
    'autocert.step.sm/duration': certificate.duration || '720h', // 30 days
  };

  if (certificate.sans && certificate.sans.length > 0) {
    extraAnnotations['autocert.step.sm/sans'] = certificate.sans.join(',');
  }

  if (certificate.initFirst) {
    extraAnnotations['autocert.step.sm/init-first'] = 'true';
  }

  if (!certificate.autoRenew) {
    extraAnnotations['autocert.step.sm/bootstrapper-only'] = 'true';
  }

  if (certificate.owner) {
    extraAnnotations['autocert.step.sm/owner'] = certificate.owner;
  }

  if (certificate.mode) {
    extraAnnotations['autocert.step.sm/mode'] = certificate.mode;
  }

  return extraAnnotations;
};
