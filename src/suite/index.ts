import { readFile } from 'fs/promises';
import { Input, Output, all } from '@pulumi/pulumi';
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
import { getVpcNativeCluster } from '../providers/GkeCluster';
import {
  ApplicationArgs,
  ApplicationContext,
  ApplicationReturn,
  ApplicationSuiteArgs,
  CustomMetric,
} from './types';
import {
  deployDebeziumKubernetesResources,
  deployDebeziumSharedDependencies,
} from '../debezium';
import { location } from '../config';

/**
 * Takes a custom definition of an autoscaling metric and turn it into a k8s definition
 */
export function customMetricToK8s(
  metric: CustomMetric,
): Input<Input<k8s.types.input.autoscaling.v2beta2.MetricSpec>[]> {
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

/**
 * Reads a Debezium properties file and replace the variables with the actual values
 */
function getDebeziumProps(
  propsPath: string,
  propsVars: Record<string, Input<string>>,
): Output<string> {
  const func = async (vars: Record<string, string>): Promise<string> => {
    const props = await readFile(propsPath, 'utf-8');
    return Object.keys(vars).reduce(
      (acc, key) => acc.replace(`%${key}%`, vars[key]),
      props,
    );
  };
  return all(propsVars).apply(func);
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
  }: ApplicationContext,
  {
    nameSuffix,
    minReplicas = 2,
    maxReplicas,
    limits,
    dependsOn,
    port,
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
    volumes,
    volumeMounts,
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
    containers: [
      {
        name: 'app',
        image,
        command,
        args,
        ports: port
          ? [{ name: 'http', containerPort: port, protocol: 'TCP' }]
          : undefined,
        readinessProbe,
        livenessProbe,
        env: [...globalEnvVars, ...env],
        resources: { requests: limits, limits },
        lifecycle: createService ? gracefulTerminationHook() : undefined,
        volumeMounts,
      },
    ],
    deploymentDependsOn: dependsOn,
    shouldCreatePDB: createService,
    provider,
  };
  if (createService) {
    return createAutoscaledExposedApplication({
      ...appArgs,
      serviceType: vpcNative ? 'ClusterIP' : serviceType,
      enableCdn,
    });
  }
  return createAutoscaledApplication(appArgs);
}

/**
 * Deploys an application suite to a single provider.
 * An application suite consists of several deployable units (i.e api, background worker).
 * A suite can also require a migration job and/or a debezium instance.
 */
export function deployApplicationSuiteToProvider({
  name,
  namespace,
  serviceAccount,
  secrets,
  image,
  imageTag,
  apps,
  provider,
  resourcePrefix = '',
  vpcNative = false,
  migration,
  debezium,
}: ApplicationSuiteArgs): ApplicationReturn[] {
  // Create an equivalent k8s service account to an existing gcp service account
  const k8sServiceAccount = createK8sServiceAccountFromGCPServiceAccount(
    `${resourcePrefix}k8s-sa`,
    name,
    namespace,
    serviceAccount,
    provider,
  );

  // Add workloadIdentityUser role to gcp service account
  new gcp.serviceaccount.IAMBinding(`${resourcePrefix}k8s-iam-binding`, {
    role: 'roles/iam.workloadIdentityUser',
    serviceAccountId: serviceAccount.id,
    members: [k8sServiceAccountToIdentity(k8sServiceAccount)],
  });

  // Convert the secrets to k8s container env vars
  const containerEnvVars = convertRecordToContainerEnvVars({
    secretName: name,
    data: secrets || {},
  });

  if (secrets) {
    // Create the secret object
    createKubernetesSecretFromRecord({
      data: secrets,
      resourceName: `${resourcePrefix}k8s-secret`,
      name,
      namespace,
      provider,
    });
  }

  // Run migration if needed
  const dependsOn: Input<Resource>[] = [];
  if (migration) {
    const migrationJob = createMigrationJob(
      `${name}-migration`,
      namespace,
      image,
      migration.args,
      containerEnvVars,
      k8sServiceAccount,
      { provider, resourcePrefix },
    );
    dependsOn.push(migrationJob);
  }

  if (debezium) {
    const props = getDebeziumProps(debezium.propsPath, {
      ...debezium.propsVars,
      topic: debezium.topicName,
    });
    const diskSize = 100;
    // IMPORTANT: do not set resource prefix here, otherwise it might create new disk and other resources
    const { debeziumKey, disk } = deployDebeziumSharedDependencies(
      name,
      `${location}-f`,
      {
        diskType: 'pd-ssd',
        diskSize,
      },
    );
    // Useful if we want to migrate Debezium without affecting its dependencies
    if (!debezium.dependenciesOnly) {
      deployDebeziumKubernetesResources(
        name,
        namespace,
        debezium.topic,
        props,
        debeziumKey,
        disk,
        {
          image: 'debezium/server:1.6',
          provider,
          resourcePrefix,
        },
      );
    }
  }

  // Deploy the applications
  return apps.map((app) =>
    deployApplication(
      {
        resourcePrefix,
        name,
        namespace,
        serviceAccount: k8sServiceAccount,
        envVars: containerEnvVars,
        imageTag,
        image,
        provider,
        vpcNative,
      },
      { ...app, dependsOn: [...dependsOn, ...(app.dependsOn || [])] },
    ),
  );
}

/**
 * Deploys an application suite to multiple providers based on our best practices
 */
export function deployApplicationSuite(
  {
    migration,
    debezium,
    ...suite
  }: Omit<ApplicationSuiteArgs, 'provider' | 'resourcePrefix' | 'vpcNative'>,
  vpcNativeProvider = getVpcNativeCluster(),
): ApplicationReturn[][] {
  // We need to run migration and debezium only on one provider
  const legacyApps = deployApplicationSuiteToProvider({
    ...suite,
    migration,
    debezium,
  });
  const vpcNativeApps = deployApplicationSuiteToProvider({
    ...suite,
    provider: vpcNativeProvider.provider,
    resourcePrefix: 'vpc-native-',
    vpcNative: true,
  });
  return [legacyApps, vpcNativeApps];
}
