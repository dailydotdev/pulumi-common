export const NodeLabelKeys = {
  Type: 'node.daily.dev/type',
  OptimizedRedis: 'node.daily.dev/optimized-redis',
} as const;

export type NodeLabel = {
  key: (typeof NodeLabelKeys)[keyof typeof NodeLabelKeys];
  value: string;
};

/**
 * A set of common node labels used in the daily.dev infrastructure.
 *
 * Labels are used to identify nodes with specific characteristics, such as high memory or high CPU.
 * A deployment can then be configured to target nodes with specific labels, either just by the key or by the key and value.
 *
 * For more information on node labels, see https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/
 */
export const NodeLabels: { [key: string]: NodeLabel } = {
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
} as const;

/**
 * Extracts the node labels from a single NodeLabel object, and returns them as a key-value pair.
 */
export const extractNodeLabels = (
  label: NodeLabel,
): { [key: string]: string } => {
  return {
    [label.key]: label.value,
  };
};
