import { readFile } from 'fs/promises';
import { Input, Output, all, ProviderResource } from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import { Resource } from '@pulumi/pulumi/resource';
import * as gcp from '@pulumi/gcp';
import {
  convertRecordToContainerEnvVars,
  createAutoscaledApplication,
  createAutoscaledExposedApplication,
  createK8sServiceAccountFromGCPServiceAccount,
  createKubernetesSecretFromRecord,
  createMigrationJob,
  getFullSubscriptionLabel,
  getMemoryAndCpuMetrics,
  getPubSubUndeliveredMessagesMetric,
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
import { location } from '../config';
import { stripCpuFromLimits } from '../utils';

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
              type: 'Value',
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

function createAndBindK8sServiceAccount(
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
      return `${propsStr}\ndebezium.sink.pubsub.address=pubsub:8085\ndebezium.sink.pubsub.project.id=local`;
    }
    return propsStr;
  };
  return all(propsVars).apply(func);
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
    envVars: globalEnvVars,
    serviceAccount,
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
  }: CronArgs,
): k8s.batch.v1.CronJob {
  const appResourcePrefix = `${resourcePrefix}${
    nameSuffix ? `${nameSuffix}-` : ''
  }`;
  const appName = `${name}${nameSuffix ? `-${nameSuffix}` : ''}`;
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
                  ...labels,
                },
              },
              spec: {
                restartPolicy: 'OnFailure',
                volumes,
                serviceAccountName: serviceAccount?.metadata.name,
                containers: [
                  {
                    name: 'app',
                    image,
                    command,
                    args,
                    volumeMounts,
                    env: [...globalEnvVars, ...env],
                    resources: {
                      requests: requests ?? limits,
                      limits: stripCpuFromLimits(limits),
                    },
                  },
                ],
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
    envVars: globalEnvVars,
    provider,
    vpcNative,
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
  }: ApplicationArgs,
): ApplicationReturn {
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
        name: 'app',
        image,
        command,
        args,
        ports,
        readinessProbe,
        livenessProbe,
        env: [...globalEnvVars, ...env],
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
  };
  if (createService || servicePorts.length > 0) {
    return createAutoscaledExposedApplication({
      ...appArgs,
      serviceType: vpcNative ? 'ClusterIP' : serviceType,
      enableCdn,
      serviceTimeout,
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
  vpcNative = false,
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

  // Convert the secrets to k8s container env vars
  const containerEnvVars = convertRecordToContainerEnvVars({
    secretName: name,
    data: secrets || {},
  });

  const dependsOn: Input<Resource>[] = suiteDependsOn ?? [];
  if (secrets) {
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
      containerEnvVars,
      k8sServiceAccount,
      { provider, resourcePrefix, dependsOn: suiteDependsOn },
    );
    dependsOn.push(migrationJob);
  }

  // Run migrations if needed
  if (migrations) {
    Object.keys(migrations).map((key) => {
      const migrationJob = createMigrationJob(
        `${name}-${key}-migration`,
        namespace,
        image,
        migrations[key].args,
        containerEnvVars,
        k8sServiceAccount,
        { provider, resourcePrefix, dependsOn: suiteDependsOn },
      );
      dependsOn.push(migrationJob);
    });
  }

  if (debezium) {
    const propsVars = {
      ...debezium.propsVars,
    };
    if (debezium.topicName) {
      propsVars.topic = debezium.topicName;
    }
    const props = getDebeziumProps(debezium.propsPath, propsVars, isAdhocEnv);
    const diskSize = 100;
    // IMPORTANT: do not set resource prefix here, otherwise it might create new disk and other resources
    const { debeziumKey, disk } = deployDebeziumSharedDependencies(
      name,
      `${location}-f`,
      {
        diskType: 'pd-ssd',
        diskSize,
        isAdhocEnv,
      },
    );
    // Useful if we want to migrate Debezium without affecting its dependencies
    if (!debezium.dependenciesOnly) {
      const debeziumDefault = isAdhocEnv ? '2.0' : '1.6';
      deployDebeziumKubernetesResources(
        name,
        namespace,
        props,
        debeziumKey,
        disk,
        {
          image: `debezium/server:${debezium.version ?? debeziumDefault}`,
          provider,
          resourcePrefix,
          limits: debezium.limits,
          isAdhocEnv,
          env: debezium.env,
          disableHealthCheck: debezium.disableHealthCheck,
        },
      );
    }
  }

  const context: ApplicationContext = {
    resourcePrefix,
    name,
    namespace,
    serviceAccount: k8sServiceAccount,
    envVars: containerEnvVars,
    imageTag,
    image,
    provider,
    vpcNative,
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
    'provider' | 'resourcePrefix' | 'vpcNative' | 'shouldBindIamUser'
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
      vpcNative: true,
    });
    return [vpcNativeApps];
  }
}
