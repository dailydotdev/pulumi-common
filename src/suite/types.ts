import type * as gcp from '@pulumi/gcp';
import type * as k8s from '@pulumi/kubernetes';
import { type Input, type ProviderResource } from '@pulumi/pulumi';
import { type Resource } from '@pulumi/pulumi/resource';

import {
  type ContainerOptions,
  type KubernetesApplicationArgs,
  type KubernetesApplicationReturn,
  type PodResources,
  type Spot,
} from '../k8s';
import type {
  AutocertCertificate,
  PodAnnotations,
  Resources,
} from '../kubernetes';

export interface MetricMemoryCPU {
  type: 'memory_cpu';
  memory?: number;
  cpu: number;
}

export interface MetricPubsub {
  type: 'pubsub';
  labels: Record<string, string>;
  targetAverageValue: number;
}

export type CustomMetric = MetricPubsub | MetricMemoryCPU;

export interface ApplicationArgs {
  nameSuffix?: string;
  minReplicas?: number;
  maxReplicas: number;
  limits: Input<PodResources>;
  requests?: Input<PodResources>;
  dependsOn?: Input<Resource>[];
  /** @deprecated please use the new ports */
  port?: number;
  readinessProbe?: Input<k8s.types.input.core.v1.Probe>;
  livenessProbe?: Input<k8s.types.input.core.v1.Probe>;
  env?: Input<k8s.types.input.core.v1.EnvVar>[];
  createService?: boolean;
  isApi?: boolean;
  serviceType?: k8s.types.enums.core.v1.ServiceSpecType;
  metric: CustomMetric;
  labels?: Record<string, string>;
  command?: Input<Input<string>[]>;
  args?: Input<Input<string>[]>;
  enableCdn?: boolean;
  serviceTimeout?: number;
  volumes?: Input<Input<k8s.types.input.core.v1.Volume>[]>;
  volumeMounts?: Input<Input<k8s.types.input.core.v1.VolumeMount>[]>;
  disableLifecycle?: boolean;
  podAnnotations?: Input<PodAnnotations>;
  ports?: k8s.types.input.core.v1.ContainerPort[];
  servicePorts?: k8s.types.input.core.v1.ServicePort[];
  backendConfig?: KubernetesApplicationArgs['backendConfig'];
  spot?: Spot;
  certificate?: AutocertCertificate;
}

export type ApplicationReturn = KubernetesApplicationReturn & {
  service?: k8s.core.v1.Service;
};

export interface MigrationArgs {
  args: string[];
  toleratesSpot?: boolean;
  certificate?: Omit<AutocertCertificate, 'duration'>;
}

export interface CronArgs {
  nameSuffix?: string;
  schedule?: string;
  concurrencyPolicy?: string;
  activeDeadlineSeconds?: number;
  limits: Input<PodResources>;
  requests?: Input<PodResources>;
  dependsOn?: Input<Resource>[];
  env?: Input<k8s.types.input.core.v1.EnvVar>[];
  labels?: Record<string, string>;
  command?: Input<Input<string>[]>;
  args?: Input<Input<string>[]>;
  volumes?: Input<Input<k8s.types.input.core.v1.Volume>[]>;
  volumeMounts?: Input<Input<k8s.types.input.core.v1.VolumeMount>[]>;
  spot?: Spot;
  suspend?: boolean;
  podAnnotations?: Input<Record<string, Input<string>>>;
  certificate?: Omit<AutocertCertificate, 'duration'>;
}

export interface DebeziumArgs {
  topicName?: string;
  propsPath: string;
  propsVars: Record<string, Input<string>>;
  dependenciesOnly?: boolean;
  version?: string;
  requests: Resources['requests'];
  limits: Resources['limits'];
  env?: Input<k8s.types.input.core.v1.EnvVar>[];
  disableHealthCheck?: boolean;
  affinity?: Input<k8s.types.input.core.v1.Affinity>;
  certificate?: AutocertCertificate;
}

export interface AdditionalSecret {
  name: string;
  data: Input<Record<string, Input<string>>>;
}

export interface ApplicationSuiteArgs {
  name: string;
  namespace: string;
  serviceAccount?: gcp.serviceaccount.Account;
  secrets?: Record<string, Input<string>>;
  additionalSecrets?: AdditionalSecret[];
  image: string;
  imageTag: string;
  apps: ApplicationArgs[];
  provider?: ProviderResource;
  resourcePrefix?: string;
  migration?: MigrationArgs;
  migrations?: Record<string, MigrationArgs>;
  debezium?: DebeziumArgs;
  crons?: CronArgs[];
  shouldBindIamUser: boolean;
  isAdhocEnv?: boolean;
  dependsOn?: Input<Resource>[];
  dotEnvFileName?: string | null;
}

export interface ApplicationContext {
  resourcePrefix: string;
  name: string;
  namespace: string;
  serviceAccount?: k8s.core.v1.ServiceAccount;
  image: string;
  imageTag: string;
  containerOpts: ContainerOptions;
  provider?: ProviderResource;
  isAdhocEnv?: boolean;
}
