"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KubernetesRedisCluster = void 0;
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const constants_1 = require("../../constants");
const common_1 = require("./common");
const kubernetes_1 = require("../../kubernetes");
class KubernetesRedisCluster extends pulumi.ComponentResource {
    constructor(name, args, resourceOptions) {
        var _a, _b;
        super(`${constants_1.urnPrefix}:KubernetesRedisCluster`, name, args, resourceOptions);
        new k8s.helm.v3.Release(name, Object.assign(Object.assign({}, kubernetes_1.charts['redis-cluster']), { namespace: args.namespace, createNamespace: false, atomic: true, timeout: args.timeout, values: {
                fullnameOverride: name,
                commonConfiguration: (0, common_1.configureConfiguration)({
                    modules: args.modules,
                    configuration: args.configuration,
                }),
                commonAnnotations: {
                    'cluster-autoscaler.kubernetes.io/safe-to-evict': (_b = (_a = args === null || args === void 0 ? void 0 : args.safeToEvict) === null || _a === void 0 ? void 0 : _a.valueOf()) !== null && _b !== void 0 ? _b : 'false',
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
                usePassword: !!args.authKey,
                password: args.authKey,
                cluster: {
                    nodes: args.nodes,
                    replicas: args.replicas,
                },
                redis: {
                    resources: (0, common_1.configureResources)({
                        isAdhocEnv: args.isAdhocEnv,
                        memorySizeGb: args.memorySizeGb,
                        cpuSize: args.cpuSize,
                    }),
                    affinity: args.affinity,
                    tolerations: args.tolerations,
                    priorityClassName: (0, common_1.configurePriorityClass)(args),
                },
                persistence: (0, common_1.configurePersistence)({
                    memorySizeGb: args.memorySizeGb,
                    storageSizeGb: args.storageSizeGb,
                    persistence: args.persistence,
                }),
            } }), resourceOptions);
    }
}
exports.KubernetesRedisCluster = KubernetesRedisCluster;
