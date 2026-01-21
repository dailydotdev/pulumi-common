import type * as k8s from '@pulumi/kubernetes';
import { type Input } from '@pulumi/pulumi';

import type { ChownSpec, OctalPermission } from '../utils';

export type Image =
  | {
      repository: Input<string>;
      tag: Input<string>;
      registry?: Input<string>;
      digest?: never;
    }
  | {
      repository: Input<string>;
      tag?: never;
      digest: Input<string>;
      registry?: Input<string>;
    };

export interface Resources {
  requests?: {
    cpu?: Input<string>;
    memory?: Input<string>;
    'ephemeral-storage'?: Input<string>;
  };
  limits?: {
    memory?: Input<string>;
    'ephemeral-storage'?: Input<string>;
  };
}

export interface Tolerations {
  key: Input<string>;
  value: Input<string>;
  operator: Input<'Exists' | 'Equal'>;
  effect: Input<'NoExecute' | 'NoSchedule' | 'PreferNoSchedule'>;
}

export type LabelSelectorRequirement = {
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

export interface NodeAffinity {
  requiredDuringSchedulingIgnoredDuringExecution?: Input<{
    nodeSelectorTerms: Input<
      {
        matchExpressions: Input<LabelSelectorRequirement[]>;
      }[]
    >;
  }>;
  preferredDuringSchedulingIgnoredDuringExecution?: Input<
    {
      weight: Input<number>;
      preference: Input<{
        matchExpressions: Input<LabelSelectorRequirement[]>;
      }>;
    }[]
  >;
}

export interface Affinity {
  nodeAffinity?: Input<NodeAffinity>;
}

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

export type PodAnnotations = Record<string, Input<string>>;

export interface AutocertCertificate {
  enabled?: boolean;
  name?: string;
  duration?: string;
  sans?: string[];
  initFirst?: boolean;
  autoRenew?: boolean;
  owner?: ChownSpec;
  mode?: OctalPermission;
}
