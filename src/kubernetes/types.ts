import { Input } from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

export type Image =
  | {
      repository: Input<string>;
      tag: Input<string>;
      digest?: never;
    }
  | {
      repository: Input<string>;
      tag?: never;
      digest: Input<string>;
    };

export type Resources = {
  requests: {
    cpu: Input<string>;
    memory: Input<string>;
  };
  limits: {
    memory: Input<string>;
  };
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
      values?: never;
    }
);

export type NodeAffinity = {
  requiredDuringSchedulingIgnoredDuringExecution?: Input<{
    nodeSelectorTerms: Input<
      {
        matchExpressions: Input<NodeSelectorTerms[]>;
      }[]
    >;
  }>;
  preferredDuringSchedulingIgnoredDuringExecution?: Input<
    {
      weight: Input<number>;
      preference: Input<{
        matchExpressions: Input<NodeSelectorTerms[]>;
      }>;
    }[]
  >;
};

export type Affinity = {
  nodeAffinity?: Input<NodeAffinity>;
};

export type EnvVariable =
  | {
      name: Input<string>;
      value: Input<string>;
      valueFrom?: never;
    }
  | {
      name: Input<string>;
      value?: never;
      valueFrom: k8s.types.input.core.v1.EnvVarSource;
    };
