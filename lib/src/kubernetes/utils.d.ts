import { Output } from '@pulumi/pulumi';
import { Image, Resources } from './types';
import { AdhocEnv } from '../utils';
export declare const NodeLabelKeys: {
    readonly Type: "node.daily.dev/type";
    readonly OptimizedRedis: "node.daily.dev/optimized-redis";
    readonly DiskType: "node.daily.dev/disk-type";
    readonly Spot: "node.daily.dev/spot";
};
export type NodeLabel = {
    key: (typeof NodeLabelKeys)[keyof typeof NodeLabelKeys];
    value: string;
};
/**
 * A set of common node labels used in the daily.dev infrastructure.
 *
 * Labels are used to identify nodes with specific characteristics, such as high memory or high CPU.
 * A deployment can then be configured to target nodes with specific labels, either just by the key or by the key and value.
 *
 * For more information on node labels, see https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/
 */
export declare const NodeLabels: {
    readonly Spot: {
        readonly key: "node.daily.dev/spot";
        readonly value: "true";
    };
    readonly HighMem: {
        readonly key: "node.daily.dev/type";
        readonly value: "highmem";
    };
    readonly HighCPU: {
        readonly key: "node.daily.dev/type";
        readonly value: "highcpu";
    };
    readonly OptimizedRedisMaster: {
        readonly key: "node.daily.dev/optimized-redis";
        readonly value: "master";
    };
    readonly OptimizedRedisReplica: {
        readonly key: "node.daily.dev/optimized-redis";
        readonly value: "replica";
    };
    readonly PersistentDisk: {
        readonly key: "node.daily.dev/disk-type";
        readonly value: "persistent-disk";
    };
    readonly HyperDisk: {
        readonly key: "node.daily.dev/disk-type";
        readonly value: "hyperdisk";
    };
};
/**
 * Extracts the node labels from a single NodeLabel object, and returns them as a key-value pair.
 */
export declare const extractNodeLabels: (labels: NodeLabel | NodeLabel[]) => {
    [key: string]: string;
};
/**
 * Common labels used in the daily.dev infrastructure.
 * These labels are used to identify resources created by pulumi, and of which version of the pulumi-common library was used to create them.
 */
export declare const commonLabels: {
    readonly 'app.kubernetes.io/managed-by': "pulumi";
    readonly 'pulumi-common.daily.dev/version': string;
};
/**
 * Returns the image string to be used in a Kubernetes deployment.
 * If a digest is provided, it will be used instead of the tag.
 */
export declare const image: ({ repository, tag, digest }: Image) => string;
export declare const configureResources: (args: AdhocEnv & {
    resources?: Resources;
}) => Output<Resources> | undefined;
