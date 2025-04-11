"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPriorityClass = exports.PriorityClasses = exports.PreemptionPolicies = void 0;
const apiextensions_1 = require("@pulumi/kubernetes/apiextensions");
exports.PreemptionPolicies = {
    PreemptLowerPriority: 'PreemptLowerPriority',
    Never: 'Never',
};
exports.PriorityClasses = {
    // Default in GKE
    GmpCritical: {
        name: 'gmp-critical',
        value: 1000000000,
        description: 'Used for GMP collector pods.',
        preemptionPolicy: exports.PreemptionPolicies.PreemptLowerPriority,
    },
    // Default in GKE
    SystemClusterCritical: {
        name: 'system-cluster-critical',
        value: 2000000000,
        description: 'Used for system critical pods that must run in the cluster, but can be moved to another node if necessary.',
        preemptionPolicy: exports.PreemptionPolicies.PreemptLowerPriority,
    },
    // Default in GKE
    SystemNodeCritical: {
        name: 'system-node-critical',
        value: 2000001000,
        description: 'Used for system critical pods that must not be moved from their current node.',
        preemptionPolicy: exports.PreemptionPolicies.PreemptLowerPriority,
    },
    DailyRedis: {
        name: 'daily-redis',
        value: 900000000,
        preemptionPolicy: exports.PreemptionPolicies.PreemptLowerPriority,
        description: 'Used for stateful Redis pods.',
    },
};
const createPriorityClass = ({ name, value, description, preemptionPolicy = exports.PreemptionPolicies.PreemptLowerPriority, }, resourceOptions) => {
    // TODO: Use the PriorityClass resource when it is possible to force the name
    // https://github.com/pulumi/pulumi/discussions/17592
    return new apiextensions_1.CustomResource(name, {
        apiVersion: 'scheduling.k8s.io/v1',
        kind: 'PriorityClass',
        metadata: {
            name,
        },
        value,
        description,
        preemptionPolicy,
    }, resourceOptions);
};
exports.createPriorityClass = createPriorityClass;
