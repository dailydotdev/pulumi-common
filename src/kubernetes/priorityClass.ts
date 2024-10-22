import { PriorityClass } from '@pulumi/kubernetes/scheduling/v1';
import type { PriorityClassArgs } from '@pulumi/kubernetes/scheduling/v1alpha1';

export const PreemptionPolicies = {
  PreemptLowerPriority: 'PreemptLowerPriority',
  Never: 'Never',
};

export const PriorityClasses = {
  // Default in GKE
  GmpCritical: {
    name: 'gmp-critical',
    value: 1_000_000_000,
    description: 'Used for GMP collector pods.',
    preemptionPolicy: PreemptionPolicies.PreemptLowerPriority,
  },
  // Default in GKE
  SystemClusterCritical: {
    name: 'system-cluster-critical',
    value: 2_000_000_000,
    description:
      'Used for system critical pods that must run in the cluster, but can be moved to another node if necessary.',
    preemptionPolicy: PreemptionPolicies.PreemptLowerPriority,
  },
  // Default in GKE
  SystemNodeCritical: {
    name: 'system-node-critical',
    value: 2_000_001_000,
    description:
      'Used for system critical pods that must not be moved from their current node.',
    preemptionPolicy: PreemptionPolicies.PreemptLowerPriority,
  },
  DailyRedis: {
    name: 'daily-redis',
    value: 900_000_000,
    preemptionPolicy: PreemptionPolicies.PreemptLowerPriority,
  },
} as const;

export const createPriorityClass = ({
  name,
  value,
  description,
  preemptionPolicy = PreemptionPolicies.PreemptLowerPriority,
}: PriorityClassArgs & { name: string }) => {
  return new PriorityClass(name, {
    value,
    description,
    preemptionPolicy,
  });
};
