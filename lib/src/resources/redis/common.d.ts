import { Input, Output } from '@pulumi/pulumi';
import { Affinity, Image, Tolerations, type PriorityClassInput } from '../../kubernetes';
import { AdhocEnv } from '../../utils';
/**
 * Default modules to load in the Redis configuration.
 */
export declare const defaultModules: string[];
export declare const defaultImage: {
    repository: string;
    tag: string;
};
export type CommonK8sRedisArgs = Partial<AdhocEnv & PriorityClassInput> & {
    memorySizeGb: Input<number>;
    storageSizeGb?: Input<number>;
    cpuSize?: Input<number | string>;
    namespace: Input<string>;
    replicas: Input<number>;
    image?: Input<Image>;
    authKey?: Input<string>;
    timeout?: Input<number>;
    safeToEvict?: Input<boolean>;
    modules?: Input<string[]>;
    configuration?: Input<string>;
    disableCommands?: Input<string[]>;
    persistence?: Input<{
        enabled?: Input<boolean>;
        [key: string]: unknown;
    }>;
    metrics?: Input<{
        enabled?: Input<boolean>;
        [key: string]: unknown;
    }>;
    tolerations?: {
        master?: Input<Tolerations[]>;
        replicas?: Input<Tolerations[]>;
    };
    affinity?: {
        master?: Input<Affinity>;
        replicas?: Input<Affinity>;
    };
};
export declare const configureConfiguration: (args: Pick<CommonK8sRedisArgs, "modules" | "configuration">) => Output<string>;
export declare const configurePersistence: (args: Pick<CommonK8sRedisArgs, "memorySizeGb" | "storageSizeGb" | "persistence">) => Output<{
    size: string;
    enabled?: boolean | undefined;
    storageClass: string;
}>;
export declare const configureResources: (args: Pick<CommonK8sRedisArgs, "cpuSize" | "memorySizeGb" | "isAdhocEnv">) => Output<{
    requests: {
        cpu: string | number;
        memory: string;
    };
    limits: {
        memory: string;
    };
} | undefined>;
export declare const configurePriorityClass: (args: CommonK8sRedisArgs) => Output<string | undefined>;
