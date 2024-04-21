import { Input } from '@pulumi/pulumi';

export type Image = {
  repository: Input<string>;
  tag: Input<string>;
};

export type Tolerations = {
  key: Input<string>;
  value: Input<string>;
  operator: Input<'Exists' | 'Equal'>;
  effect: Input<'NoExecute' | 'NoSchedule' | 'PreferNoSchedule'>;
};

export type NodeSelectorTerms = {
  key: Input<string>;
} & (
  | {
      operator: Input<'In' | 'NotIn' | 'Gt' | 'Lt'>;
      values: Input<string[]>;
    }
  | {
      operator: Input<'Exists' | 'DoesNotExist'>;
    }
);

export type NodeAffinity = {
  requiredDuringSchedulingIgnoredDuringExecution?: Input<{
    nodeSelectorTerms: Input<NodeSelectorTerms[]>;
  }>;
  preferredDuringSchedulingIgnoredDuringExecution?: Input<
    {
      weight: Input<number>;
      preference: Input<{
        matchExpressions: Input<NodeSelectorTerms>;
      }>;
    }[]
  >;
};

export type Affinity = {
  nodeAffinity?: Input<NodeAffinity>;
};
