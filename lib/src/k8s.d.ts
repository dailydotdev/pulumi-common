import * as k8s from '@pulumi/kubernetes';
import { Input, Output, ProviderResource } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { autoscaling } from '@pulumi/kubernetes/types/input';
import { Resource } from '@pulumi/pulumi/resource';
export type PodResources = {
    cpu?: string;
    memory?: string;
};
export type ContainerOptions = Pick<k8s.types.input.core.v1.Container, 'envFrom'>;
export declare function k8sServiceAccountToIdentity(serviceAccount: k8s.core.v1.ServiceAccount): Output<string>;
export declare const k8sServiceAccountToWorkloadPrincipal: (serviceAccount: k8s.core.v1.ServiceAccount) => Output<string>;
export declare function createK8sServiceAccountFromGCPServiceAccount(resourceName: string, name: string, namespace: string, serviceAccount: gcp.serviceaccount.Account, provider?: ProviderResource): k8s.core.v1.ServiceAccount;
export declare function createMigrationJob(baseName: string, namespace: string, image: string, args: string[], containerOpts: ContainerOptions, serviceAccount: k8s.core.v1.ServiceAccount | undefined, { provider, resourcePrefix, dependsOn, }?: {
    provider?: ProviderResource;
    resourcePrefix?: string;
    dependsOn?: Input<Resource>[];
}, toleratesSpot?: boolean): k8s.batch.v1.Job;
export declare function getTargetRef(deployment: Input<string>): Input<autoscaling.v1.CrossVersionObjectReference>;
export declare function createVerticalPodAutoscaler(name: string, metadata: Input<k8s.types.input.meta.v1.ObjectMeta>, targetRef: Input<autoscaling.v1.CrossVersionObjectReference>, provider?: ProviderResource): k8s.apiextensions.CustomResource;
export declare const getFullSubscriptionLabel: (label: string) => string;
export declare const getPubSubUndeliveredMessagesMetric: () => string;
export declare const getMemoryAndCpuMetrics: (cpuUtilization?: number, memoryUtilization?: number) => Input<Input<k8s.types.input.autoscaling.v2.MetricSpec>[]>;
/**
 * @deprecated Use createAndBindK8sServiceAccount instead
 */
export declare const bindK8sServiceAccountToGCP: (resourcePrefix: string, name: string, namespace: string, serviceAccount: gcp.serviceaccount.Account, provider?: ProviderResource) => k8s.core.v1.ServiceAccount;
export type KubernetesApplicationArgs = {
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
    labels?: {
        [key: string]: Input<string>;
    };
    shouldCreatePDB?: boolean;
    podSpec?: Input<Omit<k8s.types.input.core.v1.PodSpec, 'containers' | 'serviceAccountName'>>;
    podAnnotations?: Input<{
        [key: string]: Input<string>;
    }>;
    provider?: ProviderResource;
    isAdhocEnv?: boolean;
    strategy?: k8s.types.input.apps.v1.DeploymentStrategy;
    ports?: k8s.types.input.core.v1.ContainerPort[];
    servicePorts?: k8s.types.input.core.v1.ServicePort[];
    backendConfig?: Input<{
        customResponseHeaders?: Input<string[]>;
        customRequestHeaders?: Input<string[]>;
    }>;
    spot?: {
        enabled: boolean;
        weight?: number;
        required?: boolean;
    };
};
export type KubernetesApplicationReturn = {
    labels: Input<{
        [key: string]: Input<string>;
    }>;
    deployment: k8s.apps.v1.Deployment;
};
export declare const gracefulTerminationHook: (delay?: number) => k8s.types.input.core.v1.Lifecycle;
export type Spot = {
    enabled: boolean;
    weight?: number;
    required?: boolean;
};
export declare const getSpotSettings: (spot?: Spot, isAdhocEnv?: boolean) => {
    tolerations: k8s.types.input.core.v1.Toleration[];
    affinity: k8s.types.input.core.v1.Affinity;
};
export declare const createAutoscaledApplication: ({ name, namespace, version, serviceAccount, containers, minReplicas, maxReplicas, metrics, resourcePrefix, deploymentDependsOn, podSpec, podAnnotations, labels: extraLabels, shouldCreatePDB, provider, isAdhocEnv, strategy, spot, }: KubernetesApplicationArgs) => KubernetesApplicationReturn;
export declare const createAutoscaledExposedApplication: ({ enableCdn, serviceTimeout, shouldCreatePDB, provider, serviceType, strategy, backendConfig, servicePorts, ...args }: KubernetesApplicationArgs & {
    enableCdn?: boolean;
    serviceTimeout?: number;
    serviceType?: k8s.types.enums.core.v1.ServiceSpecType;
}) => KubernetesApplicationReturn & {
    service: k8s.core.v1.Service;
};
export declare function createKubernetesSecretFromRecord({ data, resourceName, name, namespace, provider, }: {
    data: Record<string, Input<string>>;
    resourceName: string;
    name: string;
    namespace: string;
    provider?: ProviderResource;
}): k8s.core.v1.Secret;
