import { Input, ProviderResource } from '@pulumi/pulumi';
import { Resource } from '@pulumi/pulumi/resource';
import * as k8s from '@pulumi/kubernetes';
import { KubernetesApplicationReturn, Limits } from '../k8s';
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
  limits: Input<Limits>;
  dependsOn?: Input<Resource>[];
  port?: number;
  readinessProbe?: Input<k8s.types.input.core.v1.Probe>;
  livenessProbe?: Input<k8s.types.input.core.v1.Probe>;
  env?: Input<k8s.types.input.core.v1.EnvVar>[];
  createService?: boolean;
  serviceType?: k8s.types.enums.core.v1.ServiceSpecType;
  metric: CustomMetric;
  labels?: { [key: string]: string };
  command?: Input<Input<string>[]>;
  args?: Input<Input<string>[]>;
  enableCdn?: boolean;
  volumes?: Input<Input<k8s.types.input.core.v1.Volume>[]>;
  volumeMounts?: Input<Input<k8s.types.input.core.v1.VolumeMount>[]>;
};

export type ApplicationReturn = KubernetesApplicationReturn & {
  service?: k8s.core.v1.Service;
};

export type MigrationArgs = {
  args: string[];
};

export type CronArgs = {
  nameSuffix?: string;
  schedule: string;
  concurrencyPolicy?: string;
  limits: Input<Limits>;
  dependsOn?: Input<Resource>[];
  env?: Input<k8s.types.input.core.v1.EnvVar>[];
  labels?: { [key: string]: string };
  command?: Input<Input<string>[]>;
  args?: Input<Input<string>[]>;
  volumes?: Input<Input<k8s.types.input.core.v1.Volume>[]>;
  volumeMounts?: Input<Input<k8s.types.input.core.v1.VolumeMount>[]>;
};

export type DebeziumArgs = {
  topicName: string;
  propsPath: string;
  propsVars: Record<string, Input<string>>;
  dependenciesOnly?: boolean;
  version?: string;
  limits?: Limits;
};

export type ApplicationSuiteArgs = {
  name: string;
  namespace: string;
  serviceAccount: gcp.serviceaccount.Account;
  secrets?: Record<string, Input<string>>;
  image: string;
  imageTag: string;
  apps: ApplicationArgs[];
  provider?: ProviderResource;
  resourcePrefix?: string;
  vpcNative?: boolean;
  migration?: MigrationArgs;
  debezium?: DebeziumArgs;
  crons?: CronArgs[];
  shouldBindIamUser: boolean;
};

export type ApplicationContext = {
  resourcePrefix: string;
  name: string;
  namespace: string;
  serviceAccount: k8s.core.v1.ServiceAccount;
  image: string;
  imageTag: string;
  envVars: k8s.types.input.core.v1.EnvVar[];
  provider?: ProviderResource;
  vpcNative: boolean;
};
