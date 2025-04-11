import { Input, Output } from '@pulumi/pulumi';
import { PodResources } from './k8s';
export type AdhocEnv = {
    isAdhocEnv: boolean;
};
export declare const isNullOrUndefined: (value: unknown) => value is null | undefined;
export declare function camelToUnderscore(key: string): string;
export declare function nodeOptions(memory: number): {
    name: string;
    value: string;
};
export declare function stripCpuFromLimits(requests: Input<PodResources>): Output<Omit<PodResources, 'cpu'>>;
export declare const gcpProjectNumber: () => string;
