import { Input, ProviderResource } from '@pulumi/pulumi';
import { Resource } from '@pulumi/pulumi/resource';
import * as k8s from '@pulumi/kubernetes';
import {
  ContainerOptions,
  KubernetesApplicationArgs,
  KubernetesApplicationReturn,
  PodResources,
  Spot,
} from '../k8s';
import * as gcp from '@pulumi/gcp';

export type MetricMemoryCPU = {
  type: 'memory_cpu';
  memory?: number;
  cpu: number;
};

export type MetricPubsub = {
  type: 'pubsub';
  labels: { [key: string]: string };
  targetAverageValue: number;
};

export type CustomMetric = MetricPubsub | MetricMemoryCPU;

export type ApplicationArgs = {
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
  labels?: { [key: string]: string };
  command?: Input<Input<string>[]>;
  args?: Input<Input<string>[]>;
  enableCdn?: boolean;
  serviceTimeout?: number;
  volumes?: Input<Input<k8s.types.input.core.v1.Volume>[]>;
  volumeMounts?: Input<Input<k8s.types.input.core.v1.VolumeMount>[]>;
  disableLifecycle?: boolean;
  podAnnotations?: Input<{ [key: string]: Input<string> }>;
  ports?: k8s.types.input.core.v1.ContainerPort[];
  servicePorts?: k8s.types.input.core.v1.ServicePort[];
  backendConfig?: KubernetesApplicationArgs['backendConfig'];
  spot?: Spot;
};

export type ApplicationReturn = KubernetesApplicationReturn & {
  service?: k8s.core.v1.Service;
};

export type MigrationArgs = {
  args: string[];
  toleratesSpot?: boolean;
};

export type CronArgs = {
  nameSuffix?: string;
  schedule?: string;
  concurrencyPolicy?: string;
  activeDeadlineSeconds?: number;
  limits: Input<PodResources>;
  requests?: Input<PodResources>;
  dependsOn?: Input<Resource>[];
  env?: Input<k8s.types.input.core.v1.EnvVar>[];
  labels?: { [key: string]: string };
  command?: Input<Input<string>[]>;
  args?: Input<Input<string>[]>;
  volumes?: Input<Input<k8s.types.input.core.v1.Volume>[]>;
  volumeMounts?: Input<Input<k8s.types.input.core.v1.VolumeMount>[]>;
  spot?: Spot;
  suspend?: boolean;
  podAnnotations?: Input<{ [key: string]: Input<string> }>;
};

export type DebeziumArgs = {
  topicName?: string;
  propsPath: string;
  propsVars: Record<string, Input<string>>;
  dependenciesOnly?: boolean;
  version?: string;
  limits?: PodResources;
  env?: Input<k8s.types.input.core.v1.EnvVar>[];
  disableHealthCheck?: boolean;
  affinity?: Input<k8s.types.input.core.v1.Affinity>;
};

export type AdditionalSecret = {
  name: string;
  data: Input<{ [key: string]: Input<string> }>;
};

export type ApplicationSuiteArgs = {
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
  migrations?: { [key: string]: MigrationArgs };
  debezium?: DebeziumArgs;
  crons?: CronArgs[];
  shouldBindIamUser: boolean;
  isAdhocEnv?: boolean;
  dependsOn?: Input<Resource>[];
  dotEnvFileName?: string | null;
};

export type ApplicationContext = {
  resourcePrefix: string;
  name: string;
  namespace: string;
  serviceAccount?: k8s.core.v1.ServiceAccount;
  image: string;
  imageTag: string;
  containerOpts: ContainerOptions;
  provider?: ProviderResource;
  isAdhocEnv?: boolean;
};
