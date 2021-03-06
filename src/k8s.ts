import * as k8s from '@pulumi/kubernetes';
import { Input, Output, interpolate } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { autoscaling, core } from '@pulumi/kubernetes/types/input';
import EnvVar = core.v1.EnvVar;
import { Resource } from '@pulumi/pulumi/resource';
import { camelToUnderscore } from './utils';

export function k8sServiceAccountToIdentity(
  serviceAccount: k8s.core.v1.ServiceAccount,
): Output<string> {
  return serviceAccount.metadata.apply(
    (metadata) =>
      `serviceAccount:${gcp.config.project}.svc.id.goog[${metadata.namespace}/${metadata.name}]`,
  );
}

export function createK8sServiceAccountFromGCPServiceAccount(
  resourceName: string,
  name: string,
  namespace: string,
  serviceAccount: gcp.serviceaccount.Account,
): k8s.core.v1.ServiceAccount {
  return new k8s.core.v1.ServiceAccount(resourceName, {
    metadata: {
      namespace,
      name,
      annotations: {
        'iam.gke.io/gcp-service-account': serviceAccount.email,
      },
    },
  });
}

export function createMigrationJob(
  name: string,
  namespace: string,
  image: string,
  args: string[],
  env: Input<Input<EnvVar>[]>,
  serviceAccount: k8s.core.v1.ServiceAccount,
): k8s.batch.v1.Job {
  return new k8s.batch.v1.Job(
    name,
    {
      metadata: {
        name,
        namespace,
      },
      spec: {
        completions: 1,
        template: {
          spec: {
            containers: [
              {
                name: 'app',
                image,
                args,
                env,
              },
            ],
            serviceAccountName: serviceAccount.metadata.name,
            restartPolicy: 'Never',
          },
        },
      },
    },
    { deleteBeforeReplace: true },
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
): k8s.apiextensions.CustomResource {
  return new k8s.apiextensions.CustomResource(name, {
    apiVersion: 'autoscaling.k8s.io/v1',
    kind: 'VerticalPodAutoscaler',
    metadata,
    spec: {
      targetRef,
      updatePolicy: {
        updateMode: 'Off',
      },
    },
  });
}

export const getFullSubscriptionLabel = (label: string): string =>
  `metadata.user_labels.${label}`;

export const getPubSubUndeliveredMessagesMetric = (): string =>
  'pubsub.googleapis.com|subscription|num_undelivered_messages';

export const getMemoryAndCpuMetrics = (
  cpuUtilization = 70,
  memoryUtilization = cpuUtilization,
): Input<Input<k8s.types.input.autoscaling.v2beta2.MetricSpec>[]> => [
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

export const bindK8sServiceAccountToGCP = (
  resourcePrefix: string,
  name: string,
  namespace: string,
  serviceAccount: gcp.serviceaccount.Account,
): k8s.core.v1.ServiceAccount => {
  const k8sServiceAccount = createK8sServiceAccountFromGCPServiceAccount(
    `${resourcePrefix}k8s-sa`,
    name,
    namespace,
    serviceAccount,
  );

  new gcp.serviceaccount.IAMBinding(`${resourcePrefix}k8s-iam-binding`, {
    role: 'roles/iam.workloadIdentityUser',
    serviceAccountId: serviceAccount.id,
    members: [k8sServiceAccountToIdentity(k8sServiceAccount)],
  });

  return k8sServiceAccount;
};

type KubernetesApplicationArgs = {
  name: string;
  namespace: string;
  version: string;
  serviceAccount: k8s.core.v1.ServiceAccount;
  containers: Input<Input<k8s.types.input.core.v1.Container>[]>;
  minReplicas?: number;
  maxReplicas: number;
  metrics: Input<Input<k8s.types.input.autoscaling.v2beta2.MetricSpec>[]>;
  resourcePrefix?: string;
  deploymentDependsOn?: Input<Resource>[];
  labels?: {
    [key: string]: Input<string>;
  };
  shouldCreatePDB?: boolean;
  podSpec?: Input<
    Omit<k8s.types.input.core.v1.PodSpec, 'containers' | 'serviceAccountName'>
  >;
};

type KubernetesApplicationReturn = {
  labels: Input<{ [key: string]: Input<string> }>;
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
  labels: extraLabels,
  shouldCreatePDB = false,
}: KubernetesApplicationArgs): KubernetesApplicationReturn => {
  const labels: Input<{
    [key: string]: Input<string>;
  }> = {
    app: name,
    ...extraLabels,
  };

  const versionLabels: Input<{
    [key: string]: Input<string>;
  }> = {
    ...labels,
    version,
  };

  new k8s.apps.v1.Deployment(
    `${resourcePrefix}deployment`,
    {
      metadata: {
        name,
        namespace: namespace,
        labels: versionLabels,
      },
      spec: {
        replicas: minReplicas,
        selector: { matchLabels: labels },
        template: {
          metadata: { labels },
          spec: {
            containers,
            serviceAccountName: serviceAccount.metadata.name,
            ...podSpec,
          },
        },
      },
    },
    { dependsOn: deploymentDependsOn },
  );

  const targetRef = getTargetRef(name);
  createVerticalPodAutoscaler(
    `${resourcePrefix}vpa`,
    {
      name,
      namespace: namespace,
      labels,
    },
    targetRef,
  );

  new k8s.autoscaling.v2beta2.HorizontalPodAutoscaler(`${resourcePrefix}hpa`, {
    metadata: {
      name,
      namespace: namespace,
      labels,
    },
    spec: {
      minReplicas,
      maxReplicas: maxReplicas,
      metrics,
      scaleTargetRef: targetRef,
    },
  });

  if (shouldCreatePDB) {
    new k8s.policy.v1.PodDisruptionBudget(`${resourcePrefix}pdb`, {
      metadata: {
        name,
        namespace: namespace,
        labels,
      },
      spec: {
        minAvailable: 1,
        selector: {
          matchLabels: labels,
        },
      },
    });
  }

  return { labels };
};

export const createAutoscaledExposedApplication = ({
  enableCdn = false,
  shouldCreatePDB = true,
  ...args
}: KubernetesApplicationArgs & {
  enableCdn?: boolean;
}): KubernetesApplicationReturn => {
  const { resourcePrefix = '', name, namespace } = args;
  const { labels } = createAutoscaledApplication({ ...args, shouldCreatePDB });
  const annotations: Record<string, Output<string>> = {};
  if (enableCdn) {
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
        spec: {
          cdn: {
            enabled: true,
            cachePolicy: {
              includeHost: true,
              includeProtocol: true,
              includeQueryString: true,
            },
          },
        },
      },
    );
    annotations['beta.cloud.google.com/backend-config'] =
      config.metadata.name.apply((name) => `{"ports": {"http": "${name}"}}`);
  }
  new k8s.core.v1.Service(`${resourcePrefix}service`, {
    metadata: {
      name,
      namespace,
      labels,
      annotations,
    },
    spec: {
      type: 'NodePort',
      ports: [{ port: 80, targetPort: 'http', protocol: 'TCP', name: 'http' }],
      selector: labels,
    },
  });
  return { labels };
};

export function createKubernetesSecretFromRecord({
  data,
  resourceName,
  name,
  namespace,
}: {
  data: Record<string, Input<string>>;
  resourceName: string;
  name: string;
  namespace: string;
}): k8s.core.v1.Secret {
  return new k8s.core.v1.Secret(resourceName, {
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
  });
}

export function convertRecordToContainerEnvVars({
  secretName,
  data,
}: {
  secretName: string;
  data: Record<string, Input<string>>;
}): k8s.types.input.core.v1.EnvVar[] {
  return Object.keys(data).map((key) => ({
    name: camelToUnderscore(key),
    valueFrom: {
      secretKeyRef: {
        name: secretName,
        key: camelToUnderscore(key),
      },
    },
  }));
}
