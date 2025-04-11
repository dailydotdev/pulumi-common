import { CustomResource } from '@pulumi/kubernetes/apiextensions';
import type { PriorityClassArgs } from '@pulumi/kubernetes/scheduling/v1alpha1';
import type { CustomResourceOptions, Input } from '@pulumi/pulumi';
export declare const PreemptionPolicies: {
    PreemptLowerPriority: string;
    Never: string;
};
export declare const PriorityClasses: {
    readonly GmpCritical: {
        readonly name: "gmp-critical";
        readonly value: 1000000000;
        readonly description: "Used for GMP collector pods.";
        readonly preemptionPolicy: string;
    };
    readonly SystemClusterCritical: {
        readonly name: "system-cluster-critical";
        readonly value: 2000000000;
        readonly description: "Used for system critical pods that must run in the cluster, but can be moved to another node if necessary.";
        readonly preemptionPolicy: string;
    };
    readonly SystemNodeCritical: {
        readonly name: "system-node-critical";
        readonly value: 2000001000;
        readonly description: "Used for system critical pods that must not be moved from their current node.";
        readonly preemptionPolicy: string;
    };
    readonly DailyRedis: {
        readonly name: "daily-redis";
        readonly value: 900000000;
        readonly preemptionPolicy: string;
        readonly description: "Used for stateful Redis pods.";
    };
};
export type PriorityClass = (typeof PriorityClasses)[keyof typeof PriorityClasses];
export type PriorityClassInput = {
    /**
     * The priority class to use for the Redis pods.
     * If not provided, the default priority class will be used.
     * If provided, the priority class must be defined in the `PriorityClasses` object.
     *
     * This option is mutually exclusive with `priorityClass`.
     * If both are provided, `priorityClassName` will be used.
     */
    priorityClass: Input<PriorityClass>;
    priorityClassName: never;
} | {
    priorityClass: never;
    /**
     * The name of the priority class to use for the Redis pods.
     * If not provided, the default priority class will be used.
     *
     * This option is mutually exclusive with `priorityClass`.
     * If both are provided, `priorityClassName` will be used.
     */
    priorityClassName: Input<string>;
};
export declare const createPriorityClass: ({ name, value, description, preemptionPolicy, }: PriorityClassArgs & {
    name: string;
}, resourceOptions?: CustomResourceOptions) => CustomResource;
