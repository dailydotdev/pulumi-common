import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Input, Output, ProviderResource } from '@pulumi/pulumi';
import { input as inputs } from '@pulumi/kubernetes/types';
import { PodResources } from './k8s';
type OptionalArgs = {
    limits?: Input<PodResources>;
    env?: pulumi.Input<inputs.core.v1.EnvVar>[];
    image?: string;
    resourcePrefix?: string;
    provider?: ProviderResource;
    isAdhocEnv?: boolean;
    disableHealthCheck?: boolean;
    affinity?: pulumi.Input<k8s.types.input.core.v1.Affinity>;
};
/**
 * Deploys only the shared dependencies for Debezium.
 * This is the service account.
 */
export declare function deployDebeziumSharedDependencies({ name, resourcePrefix, isAdhocEnv, }: {
    name: string;
    namespace: string;
} & Pick<OptionalArgs, 'resourcePrefix' | 'isAdhocEnv'>): {
    debeziumSa?: gcp.serviceaccount.Account;
    debeziumKey?: gcp.serviceaccount.Key;
};
/**
 * Deploys only the Kubernetes resources for Debezium
 */
export declare function deployDebeziumKubernetesResources(name: string, namespace: string | Input<string>, debeziumPropsString: Output<string>, debeziumKey: gcp.serviceaccount.Key | undefined, { limits: requests, env, image, resourcePrefix, provider, isAdhocEnv, disableHealthCheck, affinity, version, }?: Pick<OptionalArgs, 'limits' | 'env' | 'image' | 'resourcePrefix' | 'provider' | 'isAdhocEnv' | 'disableHealthCheck' | 'affinity'> & {
    version?: string;
}): void;
export {};
