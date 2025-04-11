"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KubernetesRedis = void 0;
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const constants_1 = require("../../constants");
const kubernetes_1 = require("../../kubernetes");
const common_1 = require("./common");
class KubernetesRedis extends pulumi.ComponentResource {
    constructor(name, args, resourceOptions) {
        var _a, _b, _c;
        super(`${constants_1.urnPrefix}:KubernetesRedis`, name, args, resourceOptions);
        const redisInstance = {
            disableCommands: (_a = args.disableCommands) !== null && _a !== void 0 ? _a : [],
            persistence: (0, common_1.configurePersistence)({
                memorySizeGb: args.memorySizeGb,
                storageSizeGb: args.storageSizeGb,
                persistence: args.persistence,
            }),
            resources: (0, common_1.configureResources)({
                isAdhocEnv: args.isAdhocEnv,
                memorySizeGb: args.memorySizeGb,
                cpuSize: args.cpuSize,
            }),
            priorityClassName: (0, common_1.configurePriorityClass)(args),
        };
        new k8s.helm.v3.Release(name, Object.assign(Object.assign({}, kubernetes_1.charts['redis']), { namespace: args.namespace, createNamespace: false, atomic: true, timeout: args.timeout, allowNullValues: true, values: {
                fullnameOverride: name,
                commonConfiguration: (0, common_1.configureConfiguration)({
                    modules: args.modules,
                    configuration: args.configuration,
                }),
                commonAnnotations: {
                    'cluster-autoscaler.kubernetes.io/safe-to-evict': (_c = (_b = args === null || args === void 0 ? void 0 : args.safeToEvict) === null || _b === void 0 ? void 0 : _b.valueOf()) !== null && _c !== void 0 ? _c : 'false',
                },
                commonLabels: {
                    'app.kubernetes.io/instance': name,
                },
                image: pulumi.all([args.image]).apply(([image]) => ({
                    repository: (image === null || image === void 0 ? void 0 : image.repository) || common_1.defaultImage.repository,
                    tag: (image === null || image === void 0 ? void 0 : image.tag) || common_1.defaultImage.tag,
                })),
                metrics: pulumi.all([args.metrics]).apply(([metrics]) => {
                    var _a;
                    return (Object.assign(Object.assign({}, metrics), { enabled: (_a = metrics === null || metrics === void 0 ? void 0 : metrics.enabled) !== null && _a !== void 0 ? _a : true, resourcesPreset: 'micro' }));
                }),
                // Values specific to master-slave setup
                architecture: args.architecture || 'replication',
                auth: {
                    enabled: !!args.authKey,
                    password: args.authKey,
                },
                master: pulumi
                    .all([args.affinity, args.tolerations])
                    .apply(([affinity, tolerations]) => (Object.assign(Object.assign({}, redisInstance), { affinity: affinity === null || affinity === void 0 ? void 0 : affinity.master, tolerations: tolerations === null || tolerations === void 0 ? void 0 : tolerations.master }))),
                replica: pulumi
                    .all([args.affinity, args.tolerations, args.architecture])
                    .apply(([affinity, tolerations, architecture]) => {
                    if (architecture === 'standalone') {
                        return undefined;
                    }
                    return Object.assign(Object.assign({}, redisInstance), { replicaCount: args.replicas || 3, affinity: affinity === null || affinity === void 0 ? void 0 : affinity.replicas, tolerations: tolerations === null || tolerations === void 0 ? void 0 : tolerations.replicas });
                }),
            } }), resourceOptions);
    }
}
exports.KubernetesRedis = KubernetesRedis;
