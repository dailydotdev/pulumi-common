"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureResources = exports.image = exports.commonLabels = exports.extractNodeLabels = exports.NodeLabels = exports.NodeLabelKeys = void 0;
const pulumi_1 = require("@pulumi/pulumi");
const package_json_1 = require("../../package.json");
exports.NodeLabelKeys = {
    Type: 'node.daily.dev/type',
    OptimizedRedis: 'node.daily.dev/optimized-redis',
    DiskType: 'node.daily.dev/disk-type',
    Spot: 'node.daily.dev/spot',
};
/**
 * A set of common node labels used in the daily.dev infrastructure.
 *
 * Labels are used to identify nodes with specific characteristics, such as high memory or high CPU.
 * A deployment can then be configured to target nodes with specific labels, either just by the key or by the key and value.
 *
 * For more information on node labels, see https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/
 */
exports.NodeLabels = {
    Spot: { key: exports.NodeLabelKeys.Spot, value: 'true' },
    HighMem: { key: exports.NodeLabelKeys.Type, value: 'highmem' },
    HighCPU: { key: exports.NodeLabelKeys.Type, value: 'highcpu' },
    OptimizedRedisMaster: {
        key: exports.NodeLabelKeys.OptimizedRedis,
        value: 'master',
    },
    OptimizedRedisReplica: {
        key: exports.NodeLabelKeys.OptimizedRedis,
        value: 'replica',
    },
    PersistentDisk: {
        key: exports.NodeLabelKeys.DiskType,
        value: 'persistent-disk',
    },
    HyperDisk: {
        key: exports.NodeLabelKeys.DiskType,
        value: 'hyperdisk',
    },
};
/**
 * Extracts the node labels from a single NodeLabel object, and returns them as a key-value pair.
 */
const extractNodeLabels = (labels) => {
    if (Array.isArray(labels)) {
        return labels.reduce((acc, curr) => (Object.assign(Object.assign({}, acc), (0, exports.extractNodeLabels)(curr))), {});
    }
    return {
        [labels.key]: labels.value,
    };
};
exports.extractNodeLabels = extractNodeLabels;
/**
 * Common labels used in the daily.dev infrastructure.
 * These labels are used to identify resources created by pulumi, and of which version of the pulumi-common library was used to create them.
 */
exports.commonLabels = {
    'app.kubernetes.io/managed-by': 'pulumi',
    'pulumi-common.daily.dev/version': package_json_1.version,
};
/**
 * Returns the image string to be used in a Kubernetes deployment.
 * If a digest is provided, it will be used instead of the tag.
 */
const image = ({ repository, tag, digest }) => {
    const separator = digest ? '@' : ':';
    return `${repository}${separator}${digest || tag}`;
};
exports.image = image;
const configureResources = (args) => {
    if (args.isAdhocEnv || args.resources === undefined) {
        return undefined;
    }
    return (0, pulumi_1.all)([args.resources]).apply(([resources]) => {
        return {
            requests: {
                cpu: resources.requests.cpu,
                memory: resources.requests.memory,
            },
            limits: {
                memory: resources.limits.memory,
            },
        };
    });
};
exports.configureResources = configureResources;
