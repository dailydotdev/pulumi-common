import { readFile } from 'fs/promises';
import { Input, Output, all, ProviderResource } from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { Resource } from '@pulumi/pulumi/resource';
import * as gcp from '@pulumi/gcp';
import {
  ContainerOptions,
  createAutoscaledApplication,
  createAutoscaledExposedApplication,
  createK8sServiceAccountFromGCPServiceAccount,
  createKubernetesSecretFromRecord,
  createMigrationJob,
  getFullSubscriptionLabel,
  getMemoryAndCpuMetrics,
  getPubSubUndeliveredMessagesMetric,
  getSpotSettings,
  gracefulTerminationHook,
  k8sServiceAccountToIdentity,
  KubernetesApplicationArgs,
} from '../k8s';
import { getVpcNativeCluster, GkeCluster } from '../providers/gkeCluster';
import {
  ApplicationArgs,
  ApplicationContext,
  ApplicationReturn,
  ApplicationSuiteArgs,
  CronArgs,
  CustomMetric,
} from './types';
import {
  deployDebeziumKubernetesResources,
  deployDebeziumSharedDependencies,
} from '../debezium';
import { stripCpuFromLimits } from '../utils';
import { defaultSpotWeight } from '../constants';

/**
 * Takes a custom definition of an autoscaling metric and turn it into a k8s definition
 */
export function customMetricToK8s(
  metric: CustomMetric,
): Input<Input<k8s.types.input.autoscaling.v2.MetricSpec>[]> {
  switch (metric.type) {
    case 'pubsub':
      // Expand the short label keys to full labels
      const fullLabels = Object.keys(metric.labels).reduce(
        (acc, key) => ({
          ...acc,
          [getFullSubscriptionLabel(key)]: metric.labels[key],
        }),
        {},
      );
      return [
        {
          external: {
            metric: {
              name: getPubSubUndeliveredMessagesMetric(),
              selector: {
                matchLabels: fullLabels,
              },
            },
            target: {
              type: 'AverageValue',
              averageValue: metric.targetAverageValue.toString(),
            },
          },
          type: 'External',
        },
      ];
    case 'memory_cpu':
      return getMemoryAndCpuMetrics(metric.cpu, metric.memory ?? metric.cpu);
  }
}

export function createAndBindK8sServiceAccount(
  resourcePrefix: string | undefined,
  name: string,
  namespace: string,
  gcpServiceAccount: gcp.serviceaccount.Account | undefined,
  provider: ProviderResource | undefined,
  shouldBindIamUser: boolean,
): k8s.core.v1.ServiceAccount | undefined {
  if (gcpServiceAccount) {
    // Create an equivalent k8s service account to an existing gcp service account
    const k8sServiceAccount = createK8sServiceAccountFromGCPServiceAccount(
      `${resourcePrefix}k8s-sa`,
      name,
      namespace,
      gcpServiceAccount,
      provider,
    );

    if (shouldBindIamUser) {
      // Add workloadIdentityUser role to gcp service account
      new gcp.serviceaccount.IAMBinding('k8s-iam-binding', {
        role: 'roles/iam.workloadIdentityUser',
        serviceAccountId: gcpServiceAccount.id,
        members: [k8sServiceAccountToIdentity(k8sServiceAccount)],
      });
    }
    return k8sServiceAccount;
  }
  return undefined;
}

/**
 * Reads a Debezium properties file and replace the variables with the actual values
 */
function getDebeziumProps(
  propsPath: string,
  propsVars: Record<string, Input<string>>,
  isAdhocEnv?: boolean,
): Output<string> {
  const func = async (vars: Record<string, string>): Promise<string> => {
    const props = await readFile(propsPath, 'utf-8');
    let propsStr = Object.keys(vars).reduce(
      (acc, key) => acc.replace(`%${key}%`, vars[key]),
      props,
    );
    if (isAdhocEnv) {
      if (!propsStr.includes('debezium.source.topic.prefix')) {
        propsStr +=
          '\ndebezium.source.topic.prefix=t\ndebezium.source.tombstones.on.delete=false';
      }
      if (!propsStr.includes('quarkus.log.console.json')) {
        propsStr += '\nquarkus.log.console.json=false';
      }

      return `${propsStr}\ndebezium.sink.pubsub.address=pubsub:8085\ndebezium.sink.pubsub.project.id=local`;
    }
    return propsStr;
  };
  return all(propsVars).apply(func);
}

function getDefaultSpot(createService: boolean): ApplicationArgs['spot'] {
  return createService
    ? { enabled: false, weight: defaultSpotWeight, required: false }
    : { enabled: true, weight: defaultSpotWeight, required: false };
}

/**
 * Deploys a cron job to k8s.
 */
function deployCron(
  {
    resourcePrefix,
    name,
    namespace,
    image,
    provider,
    containerOpts,
    serviceAccount,
    isAdhocEnv,
  }: ApplicationContext,
  {
    nameSuffix,
    schedule,
    concurrencyPolicy = 'Forbid',
    activeDeadlineSeconds,
    volumes,
    volumeMounts,
    env = [],
    args,
    labels = {},
    command,
    limits,
    requests,
    dependsOn,
    spot,
    suspend = false,
  }: CronArgs,
): k8s.batch.v1.CronJob {
  const appResourcePrefix = `${resourcePrefix}${
    nameSuffix ? `${nameSuffix}-` : ''
  }`;
  const appName = `${name}${nameSuffix ? `-${nameSuffix}` : ''}`;

  const { tolerations, affinity } = getSpotSettings(spot, isAdhocEnv);

  return new k8s.batch.v1.CronJob(
    `${appResourcePrefix}cron`,
    {
      metadata: {
        name: appName,
        namespace,
        labels: {
          app: appName,
          'app-type': 'cron',
          ...labels,
        },
      },
      spec: {
        schedule,
        suspend,
        concurrencyPolicy,
        successfulJobsHistoryLimit: 3,
        failedJobsHistoryLimit: 3,
        jobTemplate: {
          spec: {
            activeDeadlineSeconds: activeDeadlineSeconds,
            template: {
              metadata: {
                labels: {
                  app: appName,
                  'app-type': 'cron',
                  ...labels,
                },
              },
              spec: {
                restartPolicy: 'OnFailure',
                volumes,
                serviceAccountName: serviceAccount?.metadata.name,
                containers: [
                  {
                    ...containerOpts,
                    name: 'app',
                    image,
                    command,
                    args,
                    volumeMounts,
                    env,
                    resources: {
                      requests: requests ?? limits,
                      limits: stripCpuFromLimits(limits),
                    },
                  },
                ],
                tolerations,
                affinity: spot?.enabled ? affinity : undefined,
              },
            },
          },
        },
      },
    },
    { provider, dependsOn },
  );
}

/**
 * Deploys a single deployable unit (application) to k8s.
 * Deployable unit includes the following k8s entities: deployment, hpa, pdb (optional), and service (optional).
 * If the application requires a service, this function will also set a proper lifecycle hook to prevent 5xx on deployment.
 * It also guards against setting a service as NodePort in a VPC native cluster.
 */
function deployApplication(
  {
    resourcePrefix,
    name,
    namespace,
    serviceAccount,
    image,
    imageTag,
    containerOpts,
    provider,
    isAdhocEnv,
  }: ApplicationContext,
  {
    nameSuffix,
    minReplicas = 2,
    maxReplicas,
    limits,
    requests,
    dependsOn,
    readinessProbe,
    livenessProbe = readinessProbe,
    env = [],
    createService,
    serviceType,
    metric,
    labels,
    command,
    args,
    enableCdn,
    serviceTimeout,
    volumes,
    volumeMounts,
    disableLifecycle = true,
    podAnnotations,
    isApi = createService,
    ports = [],
    servicePorts = [],
    backendConfig,
    spot: requestedSpot,
  }: ApplicationArgs,
): ApplicationReturn {
  const shouldCreateService = createService || servicePorts.length > 0;
  const spot = requestedSpot ?? getDefaultSpot(shouldCreateService);
  const appResourcePrefix = `${resourcePrefix}${
    nameSuffix ? `${nameSuffix}-` : ''
  }`;
  const appName = `${name}${nameSuffix ? `-${nameSuffix}` : ''}`;
  const appArgs: KubernetesApplicationArgs = {
    resourcePrefix: appResourcePrefix,
    name: appName,
    namespace,
    version: imageTag,
    serviceAccount,
    labels,
    minReplicas,
    maxReplicas,
    metrics: customMetricToK8s(metric),
    podSpec: {
      volumes,
    },
    podAnnotations,
    containers: [
      {
        ...containerOpts,
        name: 'app',
        image,
        command,
        args,
        ports,
        readinessProbe,
        livenessProbe,
        env,
        resources: !isAdhocEnv
          ? { requests: requests ?? limits, limits: stripCpuFromLimits(limits) }
          : undefined,
        lifecycle:
          isApi && !isAdhocEnv && !disableLifecycle
            ? gracefulTerminationHook()
            : undefined,
        volumeMounts,
      },
    ],
    deploymentDependsOn: dependsOn,
    shouldCreatePDB: isApi,
    provider,
    isAdhocEnv,
    ports,
    servicePorts,
    spot,
  };
  if (shouldCreateService) {
    return createAutoscaledExposedApplication({
      ...appArgs,
      serviceType,
      enableCdn,
      serviceTimeout,
      backendConfig,
    });
  }
  return createAutoscaledApplication(appArgs);
}

/**
 * Deploys an application suite to a single provider.
 * An application suite consists of several deployable units (i.e. api, background worker).
 * A suite can also require a migration job and/or a debezium instance.
 */
export function deployApplicationSuiteToProvider({
  name,
  namespace,
  serviceAccount,
  secrets,
  additionalSecrets,
  image,
  imageTag,
  apps,
  provider,
  resourcePrefix = '',
  migration,
  migrations,
  debezium,
  crons,
  shouldBindIamUser,
  isAdhocEnv,
  dependsOn: suiteDependsOn,
}: ApplicationSuiteArgs): ApplicationReturn[] {
  // Create an equivalent k8s service account to an existing gcp service account
  const k8sServiceAccount = createAndBindK8sServiceAccount(
    resourcePrefix,
    name,
    namespace,
    serviceAccount,
    provider,
    shouldBindIamUser,
  );

  const containerOpts: Omit<ContainerOptions, 'args'> = {};

  const dependsOn: Input<Resource>[] = suiteDependsOn ?? [];
  if (secrets) {
    containerOpts.envFrom = [{ secretRef: { name } }];
    // Create the secret object
    const secretK8s = createKubernetesSecretFromRecord({
      data: secrets,
      resourceName: `${resourcePrefix}k8s-secret`,
      name,
      namespace,
      provider,
    });
    dependsOn.push(secretK8s);
  }
  if (additionalSecrets) {
    const secretK8s = additionalSecrets.map(
      ({ name, data }) =>
        new k8s.core.v1.Secret(
          `${resourcePrefix}${name}`,
          {
            metadata: {
              name,
              namespace,
            },
            data,
          },
          { provider },
        ),
    );
    dependsOn.concat(secretK8s);
  }

  // Run migration if needed
  if (migration) {
    const migrationJob = createMigrationJob(
      `${name}-migration`,
      namespace,
      image,
      migration.args,
      containerOpts,
      k8sServiceAccount,
      { provider, resourcePrefix, dependsOn },
      migration?.toleratesSpot ?? true,
    );
    dependsOn.push(migrationJob);
  } else if (migrations) {
    const jobs = Object.keys(migrations).map((key) => {
      return createMigrationJob(
        `${name}-${key}-migration`,
        namespace,
        image,
        migrations[key].args,
        containerOpts,
        k8sServiceAccount,
        { provider, resourcePrefix, dependsOn },
        migrations[key]?.toleratesSpot ?? true,
      );
    });
    dependsOn.push(...jobs);
  }

  if (debezium) {
    const propsVars = {
      ...debezium.propsVars,
    };
    if (debezium.topicName) {
      propsVars.topic = debezium.topicName;
    }
    const props = getDebeziumProps(debezium.propsPath, propsVars, isAdhocEnv);
    // IMPORTANT: do not set resource prefix here, otherwise it might create new resources
    const { debeziumKey } = deployDebeziumSharedDependencies({
      name,
      namespace,
      isAdhocEnv,
    });
    // Useful if we want to migrate Debezium without affecting its dependencies
    if (!debezium.dependenciesOnly) {
      const debeziumDefault = isAdhocEnv ? '2.0' : '1.6';
      deployDebeziumKubernetesResources(name, namespace, props, debeziumKey, {
        image: `quay.io/debezium/server:${debezium.version ?? debeziumDefault}`,
        provider,
        resourcePrefix,
        limits: debezium.limits,
        isAdhocEnv,
        env: debezium.env,
        disableHealthCheck: debezium.disableHealthCheck,
        affinity: debezium.affinity,
        version: debezium.version ?? debeziumDefault,
      });
    }
  }

  const context: ApplicationContext = {
    resourcePrefix,
    name,
    namespace,
    serviceAccount: k8sServiceAccount,
    containerOpts,
    imageTag,
    image,
    provider,
    isAdhocEnv,
  };
  // Deploy the applications
  const appsRet = apps.map((app) => {
    if (app.port && !app.ports) {
      app.ports = [{ name: 'http', containerPort: app.port, protocol: 'TCP' }];
    }
    return deployApplication(context, {
      ...app,
      dependsOn: [...dependsOn, ...(app.dependsOn || [])],
    });
  });

  if (crons) {
    crons.map((cron) =>
      deployCron(context, {
        ...cron,
        dependsOn: [...dependsOn, ...(cron.dependsOn || [])],
      }),
    );
  }

  return appsRet;
}

/**
 * Deploys an application suite to multiple providers based on our best practices
 */
export function deployApplicationSuite(
  suite: Omit<
    ApplicationSuiteArgs,
    'provider' | 'resourcePrefix' | 'shouldBindIamUser'
  >,
  vpcNativeProvider?: GkeCluster,
): ApplicationReturn[][] {
  if (suite.isAdhocEnv) {
    const apps = deployApplicationSuiteToProvider({
      ...suite,
      shouldBindIamUser: false,
    });
    return [apps];
  } else {
    // We need to run migration and debezium only on one provider
    const vpcNativeApps = deployApplicationSuiteToProvider({
      ...suite,
      shouldBindIamUser: true,
      provider: (vpcNativeProvider || getVpcNativeCluster()).provider,
      resourcePrefix: 'vpc-native-',
    });
    return [vpcNativeApps];
  }
}
