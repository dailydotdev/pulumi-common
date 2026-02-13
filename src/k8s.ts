import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import { type autoscaling } from '@pulumi/kubernetes/types/input';
import {
  all,
  type Input,
  interpolate,
  type Output,
  type ProviderResource,
} from '@pulumi/pulumi';
import { type Resource } from '@pulumi/pulumi/resource';

import { defaultSpotWeight } from './constants';
import {
  type AutocertCertificate,
  configureAutocertAnnotations,
  NodeLabels,
} from './kubernetes';
import { camelToUnderscore, gcpProjectNumber } from './utils';

export type PodResources = Record<'cpu' | 'memory', string>;
export type ContainerOptions = Pick<
  k8s.types.input.core.v1.Container,
  'envFrom'
>;

export function k8sServiceAccountToIdentity(
  serviceAccount: k8s.core.v1.ServiceAccount,
): Output<string> {
  return serviceAccount.metadata.apply(
    (metadata) =>
      `serviceAccount:${gcp.config.project}.svc.id.goog[${metadata.namespace}/${metadata.name}]`,
  );
}

export const k8sServiceAccountToWorkloadPrincipal = (
  serviceAccount: k8s.core.v1.ServiceAccount,
): Output<string> =>
  serviceAccount.metadata.apply(
    (metadata) =>
      `principal://iam.googleapis.com/projects/${gcpProjectNumber()}/locations/global/workloadIdentityPools/${gcp.config.project}.svc.id.goog/subject/ns/${metadata.namespace}/sa/${metadata.name}`,
  );

export function createK8sServiceAccountFromGCPServiceAccount(
  resourceName: string,
  name: string,
  namespace: string,
  serviceAccount: gcp.serviceaccount.Account,
  provider?: ProviderResource,
): k8s.core.v1.ServiceAccount {
  return new k8s.core.v1.ServiceAccount(
    resourceName,
    {
      metadata: {
        namespace,
        name,
        annotations: {
          'iam.gke.io/gcp-service-account': serviceAccount.email,
        },
      },
    },
    { provider },
  );
}

export function createMigrationJob(
  baseName: string,
  namespace: string,
  image: string,
  args: string[],
  containerOpts: ContainerOptions,
  serviceAccount: k8s.core.v1.ServiceAccount | undefined,
  {
    provider,
    resourcePrefix = '',
    dependsOn,
  }: {
    provider?: ProviderResource;
    resourcePrefix?: string;
    dependsOn?: Input<Resource>[];
  } = {},
  toleratesSpot = true,
  certificate?: Omit<AutocertCertificate, 'duration'>,
): k8s.batch.v1.Job {
  const hash = image.split(':')[1];
  const name = `${baseName}-${hash.substring(hash.length - 8)}`;
  const { tolerations } = getSpotSettings({ enabled: toleratesSpot }, false);

  return new k8s.batch.v1.Job(
    resourcePrefix + name,
    {
      metadata: {
        name,
        namespace,
        annotations: {
          ...configureAutocertAnnotations({
            ...certificate,
            duration: '6h', // A short duration for migration jobs
            name: certificate?.name || `${name}.${namespace}.svc.cluster.local`,
          }),
        },
      },
      spec: {
        completions: 1,
        template: {
          spec: {
            containers: [
              {
                ...containerOpts,
                name: 'app',
                image,
                args,
                env: [
                  { name: 'OTEL_SERVICE_NAME', value: baseName },
                  { name: 'OTEL_SERVICE_VERSION', value: hash },
                ],
              },
            ],
            serviceAccountName: serviceAccount?.metadata.name,
            restartPolicy: 'Never',
            tolerations: tolerations,
          },
        },
      },
    },
    {
      deleteBeforeReplace: true,
      provider,
      dependsOn,
    },
  );
}

export function getTargetRef(
  deployment: Input<string>,
): Input<autoscaling.v1.CrossVersionObjectReference> {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    name: deployment,
  };
}

export function createVerticalPodAutoscaler(
  name: string,
  metadata: Input<k8s.types.input.meta.v1.ObjectMeta>,
  targetRef: Input<autoscaling.v1.CrossVersionObjectReference>,
  provider?: ProviderResource,
): k8s.apiextensions.CustomResource {
  return new k8s.apiextensions.CustomResource(
    name,
    {
      apiVersion: 'autoscaling.k8s.io/v1',
      kind: 'VerticalPodAutoscaler',
      metadata,
      spec: {
        targetRef,
        updatePolicy: {
          updateMode: 'Off',
        },
      },
    },
    { provider },
  );
}

export const getFullSubscriptionLabel = (label: string): string =>
  `metadata.user_labels.${label}`;

export const getPubSubUndeliveredMessagesMetric = (): string =>
  'pubsub.googleapis.com|subscription|num_undelivered_messages';

export const getMemoryAndCpuMetrics = (
  cpuUtilization = 70,
  memoryUtilization = cpuUtilization,
): Input<Input<k8s.types.input.autoscaling.v2.MetricSpec>[]> => [
  {
    type: 'Resource',
    resource: {
      name: 'cpu',
      target: {
        type: 'Utilization',
        averageUtilization: cpuUtilization,
      },
    },
  },
  {
    type: 'Resource',
    resource: {
      name: 'memory',
      target: {
        type: 'Utilization',
        averageUtilization: memoryUtilization,
      },
    },
  },
];

/**
 * @deprecated Use createAndBindK8sServiceAccount instead
 */
export const bindK8sServiceAccountToGCP = (
  resourcePrefix: string,
  name: string,
  namespace: string,
  serviceAccount: gcp.serviceaccount.Account,
  provider?: ProviderResource,
): k8s.core.v1.ServiceAccount => {
  const k8sServiceAccount = createK8sServiceAccountFromGCPServiceAccount(
    `${resourcePrefix}k8s-sa`,
    name,
    namespace,
    serviceAccount,
    provider,
  );

  new gcp.serviceaccount.IAMBinding(`${resourcePrefix}k8s-iam-binding`, {
    role: 'roles/iam.workloadIdentityUser',
    serviceAccountId: serviceAccount.id,
    members: [k8sServiceAccountToIdentity(k8sServiceAccount)],
  });

  return k8sServiceAccount;
};

export interface KubernetesApplicationArgs {
  name: string;
  namespace: string;
  version: string;
  serviceAccount?: k8s.core.v1.ServiceAccount;
  containers: Input<Input<k8s.types.input.core.v1.Container>[]>;
  minReplicas?: number;
  maxReplicas: number;
  metrics: Input<Input<k8s.types.input.autoscaling.v2.MetricSpec>[]>;
  resourcePrefix?: string;
  deploymentDependsOn?: Input<Resource>[];
  labels?: Record<string, Input<string>>;
  shouldCreatePDB?: boolean;
  podSpec?: Input<
    Omit<k8s.types.input.core.v1.PodSpec, 'containers' | 'serviceAccountName'>
  >;
  podAnnotations?: Input<Record<string, Input<string>>>;
  provider?: ProviderResource;
  isAdhocEnv?: boolean;
  strategy?: k8s.types.input.apps.v1.DeploymentStrategy;
  ports?: k8s.types.input.core.v1.ContainerPort[];
  servicePorts?: k8s.types.input.core.v1.ServicePort[];
  backendConfig?: Input<{
    customResponseHeaders?: Input<string[]>;
    customRequestHeaders?: Input<string[]>;
    iap?: Input<Record<string, unknown>>;
    securityPolicy?: Input<string>;
  }>;
  spot?: {
    enabled: boolean;
    weight?: number;
    required?: boolean;
  };
}

export interface KubernetesApplicationReturn {
  labels: Input<Record<string, Input<string>>>;
  deployment: k8s.apps.v1.Deployment;
}

export const gracefulTerminationHook = (
  delay = 15,
): k8s.types.input.core.v1.Lifecycle => ({
  preStop: {
    exec: {
      command: ['/bin/bash', '-c', `sleep ${delay}`],
    },
  },
});

export interface Spot {
  enabled: boolean;
  weight?: number;
  required?: boolean;
}

export const getSpotSettings = (
  spot: Spot = { enabled: false, weight: defaultSpotWeight, required: false },
  isAdhocEnv?: boolean,
): {
  tolerations: k8s.types.input.core.v1.Toleration[];
  affinity: k8s.types.input.core.v1.Affinity;
} => {
  const tolerations: k8s.types.input.core.v1.Toleration[] = [];
  const affinity: k8s.types.input.core.v1.Affinity = {};

  if (spot?.enabled && !isAdhocEnv) {
    const spotWeight = spot?.weight ?? defaultSpotWeight;
    const nonSpotWeight = Math.max(1, 100 - spotWeight);
    tolerations.push({
      key: 'spot',
      operator: 'Equal',
      value: 'true',
      effect: 'NoSchedule',
    });
    affinity.nodeAffinity = spot.required
      ? {
          requiredDuringSchedulingIgnoredDuringExecution: {
            nodeSelectorTerms: [
              {
                matchExpressions: [
                  {
                    key: NodeLabels.Spot.key,
                    operator: 'In',
                    values: [NodeLabels.Spot.value],
                  },
                ],
              },
            ],
          },
        }
      : {
          preferredDuringSchedulingIgnoredDuringExecution: [
            {
              weight: spotWeight,
              preference: {
                matchExpressions: [
                  {
                    key: NodeLabels.Spot.key,
                    operator: 'Exists',
                  },
                ],
              },
            },
            {
              weight: nonSpotWeight,
              preference: {
                matchExpressions: [
                  {
                    key: NodeLabels.Spot.key,
                    operator: 'DoesNotExist',
                  },
                ],
              },
            },
          ],
        };
  }
  return { tolerations, affinity };
};

export const createAutoscaledApplication = ({
  name,
  namespace,
  version,
  serviceAccount,
  containers,
  minReplicas = 2,
  maxReplicas,
  metrics,
  resourcePrefix = '',
  deploymentDependsOn = [],
  podSpec,
  podAnnotations,
  labels: extraLabels,
  shouldCreatePDB = false,
  provider,
  isAdhocEnv,
  strategy,
  spot,
}: KubernetesApplicationArgs): KubernetesApplicationReturn => {
  const labels: Input<Record<string, Input<string>>> = {
    app: name,
    ...extraLabels,
  };

  const versionLabels: Input<Record<string, Input<string>>> = {
    ...labels,
    version,
  };

  const { tolerations, affinity } = getSpotSettings(spot, isAdhocEnv);

  const deployment = new k8s.apps.v1.Deployment(
    `${resourcePrefix}deployment`,
    {
      metadata: {
        name,
        namespace: namespace,
        labels: versionLabels,
      },
      spec: {
        selector: { matchLabels: labels },
        strategy,
        template: {
          metadata: { labels, annotations: podAnnotations },
          spec: {
            containers,
            serviceAccountName: serviceAccount?.metadata.name,
            tolerations,
            affinity: spot?.enabled ? affinity : undefined,
            ...podSpec,
          },
        },
      },
    },
    {
      dependsOn: deploymentDependsOn,
      provider,
    },
  );

  if (!isAdhocEnv) {
    const targetRef = getTargetRef(name);

    new k8s.autoscaling.v2.HorizontalPodAutoscaler(
      `${resourcePrefix}hpa`,
      {
        metadata: {
          name,
          namespace: namespace,
          labels,
          annotations: {
            'pulumi.com/patchForce': 'true',
          },
        },
        spec: {
          minReplicas,
          maxReplicas: maxReplicas,
          metrics,
          scaleTargetRef: targetRef,
        },
      },
      { provider },
    );

    if (shouldCreatePDB) {
      new k8s.policy.v1.PodDisruptionBudget(
        `${resourcePrefix}pdb`,
        {
          metadata: {
            name,
            namespace: namespace,
            labels,
          },
          spec: {
            maxUnavailable: 1,
            selector: {
              matchLabels: labels,
            },
          },
        },
        { provider },
      );
    }
  }

  return { labels, deployment };
};

export const createAutoscaledExposedApplication = ({
  enableCdn = false,
  serviceTimeout,
  shouldCreatePDB = true,
  provider,
  serviceType = 'ClusterIP',
  strategy = {
    type: 'RollingUpdate',
    rollingUpdate: {
      maxUnavailable: 1,
    },
  },
  backendConfig,
  servicePorts = [],
  ...args
}: KubernetesApplicationArgs & {
  enableCdn?: boolean;
  serviceTimeout?: number;
  serviceType?: k8s.types.enums.core.v1.ServiceSpecType;
}): KubernetesApplicationReturn & { service: k8s.core.v1.Service } => {
  const { resourcePrefix = '', name, namespace } = args;
  const returnObj = createAutoscaledApplication({
    ...args,
    shouldCreatePDB,
    provider,
    strategy,
  });
  const { labels } = returnObj;
  const annotations: Record<string, Output<string>> = {};
  if (enableCdn || serviceTimeout || backendConfig) {
    const rawSpec: Record<string, unknown> = {};
    if (enableCdn) {
      rawSpec.cdn = {
        enabled: true,
        cachePolicy: {
          includeHost: true,
          includeProtocol: true,
          includeQueryString: true,
        },
      };
    }
    if (serviceTimeout) {
      rawSpec.timeoutSec = serviceTimeout;
    }
    const spec = all([backendConfig]).apply(([backendConfig]) => {
      if (backendConfig?.customResponseHeaders) {
        rawSpec.customResponseHeaders = {
          headers: backendConfig.customResponseHeaders,
        };
      }
      if (backendConfig?.customRequestHeaders) {
        rawSpec.customRequestHeaders = {
          headers: backendConfig.customRequestHeaders,
        };
      }
      if (backendConfig?.iap) {
        rawSpec.iap = backendConfig.iap;
      }
      if (backendConfig?.securityPolicy) {
        rawSpec.securityPolicy = {
          name: backendConfig.securityPolicy,
        };
      }
      return rawSpec;
    });
    const config = new k8s.apiextensions.CustomResource(
      `${resourcePrefix}backend-config`,
      {
        apiVersion: 'cloud.google.com/v1',
        kind: 'BackendConfig',
        metadata: {
          name,
          namespace,
          labels,
        },
        spec,
      },
      { provider },
    );
    annotations['cloud.google.com/backend-config'] = config.metadata.name.apply(
      (name) => `{"default": "${name}"}`,
    );
  }

  const ports =
    servicePorts.length > 0
      ? servicePorts
      : [{ port: 80, targetPort: 'http', protocol: 'TCP', name: 'http' }];

  const service = new k8s.core.v1.Service(
    `${resourcePrefix}service`,
    {
      metadata: {
        name,
        namespace,
        labels,
        annotations,
      },
      spec: {
        type: serviceType,
        ports,
        selector: labels,
      },
    },
    { provider, dependsOn: [returnObj.deployment] },
  );
  return { ...returnObj, service };
};

export function createKubernetesSecretFromRecord({
  data,
  resourceName,
  name,
  namespace,
  provider,
}: {
  data: Record<string, Input<string>>;
  resourceName: string;
  name: string;
  namespace: string;
  provider?: ProviderResource;
}): k8s.core.v1.Secret {
  return new k8s.core.v1.Secret(
    resourceName,
    {
      metadata: {
        name,
        namespace,
        labels: {
          app: name,
        },
      },
      stringData: Object.keys(data).reduce(
        (acc, key): Record<string, Output<string>> => ({
          ...acc,
          [camelToUnderscore(key)]: interpolate`${data[key]}`,
        }),
        {},
      ),
    },
    { provider },
  );
}
