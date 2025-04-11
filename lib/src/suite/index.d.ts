import { Input, ProviderResource } from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import * as gcp from '@pulumi/gcp';
import { GkeCluster } from '../providers/gkeCluster';
import { ApplicationReturn, ApplicationSuiteArgs, CustomMetric } from './types';
/**
 * Takes a custom definition of an autoscaling metric and turn it into a k8s definition
 */
export declare function customMetricToK8s(metric: CustomMetric): Input<Input<k8s.types.input.autoscaling.v2.MetricSpec>[]>;
export declare function createAndBindK8sServiceAccount(resourcePrefix: string | undefined, name: string, namespace: string, gcpServiceAccount: gcp.serviceaccount.Account | undefined, provider: ProviderResource | undefined, shouldBindIamUser: boolean): k8s.core.v1.ServiceAccount | undefined;
/**
 * Deploys an application suite to a single provider.
 * An application suite consists of several deployable units (i.e. api, background worker).
 * A suite can also require a migration job and/or a debezium instance.
 */
export declare function deployApplicationSuiteToProvider({ name, namespace, serviceAccount, secrets, additionalSecrets, image, imageTag, apps, provider, resourcePrefix, migration, migrations, debezium, crons, shouldBindIamUser, isAdhocEnv, dependsOn: suiteDependsOn, dotEnvFileName, }: ApplicationSuiteArgs): ApplicationReturn[];
/**
 * Deploys an application suite to multiple providers based on our best practices
 */
export declare function deployApplicationSuite(suite: Omit<ApplicationSuiteArgs, 'provider' | 'resourcePrefix' | 'shouldBindIamUser'>, vpcNativeProvider?: GkeCluster): ApplicationReturn[][];
