"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAutoscaledExposedApplication = exports.createAutoscaledApplication = exports.getSpotSettings = exports.gracefulTerminationHook = exports.bindK8sServiceAccountToGCP = exports.getMemoryAndCpuMetrics = exports.getPubSubUndeliveredMessagesMetric = exports.getFullSubscriptionLabel = exports.k8sServiceAccountToWorkloadPrincipal = void 0;
exports.k8sServiceAccountToIdentity = k8sServiceAccountToIdentity;
exports.createK8sServiceAccountFromGCPServiceAccount = createK8sServiceAccountFromGCPServiceAccount;
exports.createMigrationJob = createMigrationJob;
exports.getTargetRef = getTargetRef;
exports.createVerticalPodAutoscaler = createVerticalPodAutoscaler;
exports.createKubernetesSecretFromRecord = createKubernetesSecretFromRecord;
const k8s = require("@pulumi/kubernetes");
const pulumi_1 = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");
const utils_1 = require("./utils");
const kubernetes_1 = require("./kubernetes");
const constants_1 = require("./constants");
function k8sServiceAccountToIdentity(serviceAccount) {
    return serviceAccount.metadata.apply((metadata) => `serviceAccount:${gcp.config.project}.svc.id.goog[${metadata.namespace}/${metadata.name}]`);
}
const k8sServiceAccountToWorkloadPrincipal = (serviceAccount) => serviceAccount.metadata.apply((metadata) => `principal://iam.googleapis.com/projects/${(0, utils_1.gcpProjectNumber)()}/locations/global/workloadIdentityPools/${gcp.config.project}.svc.id.goog/subject/ns/${metadata.namespace}/sa/${metadata.name}`);
exports.k8sServiceAccountToWorkloadPrincipal = k8sServiceAccountToWorkloadPrincipal;
function createK8sServiceAccountFromGCPServiceAccount(resourceName, name, namespace, serviceAccount, provider) {
    return new k8s.core.v1.ServiceAccount(resourceName, {
        metadata: {
            namespace,
            name,
            annotations: {
                'iam.gke.io/gcp-service-account': serviceAccount.email,
            },
        },
    }, { provider });
}
function createMigrationJob(baseName, namespace, image, args, containerOpts, serviceAccount, { provider, resourcePrefix = '', dependsOn, } = {}, toleratesSpot = true) {
    const hash = image.split(':')[1];
    const name = `${baseName}-${hash.substring(hash.length - 8)}`;
    const { tolerations } = (0, exports.getSpotSettings)({ enabled: toleratesSpot }, false);
    return new k8s.batch.v1.Job(resourcePrefix + name, {
        metadata: {
            name,
            namespace,
        },
        spec: {
            completions: 1,
            template: {
                spec: {
                    containers: [
                        Object.assign(Object.assign({}, containerOpts), { name: 'app', image,
                            args }),
                    ],
                    serviceAccountName: serviceAccount === null || serviceAccount === void 0 ? void 0 : serviceAccount.metadata.name,
                    restartPolicy: 'Never',
                    tolerations: tolerations,
                },
            },
        },
    }, {
        deleteBeforeReplace: true,
        provider,
        dependsOn,
    });
}
function getTargetRef(deployment) {
    return {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: deployment,
    };
}
function createVerticalPodAutoscaler(name, metadata, targetRef, provider) {
    return new k8s.apiextensions.CustomResource(name, {
        apiVersion: 'autoscaling.k8s.io/v1',
        kind: 'VerticalPodAutoscaler',
        metadata,
        spec: {
            targetRef,
            updatePolicy: {
                updateMode: 'Off',
            },
        },
    }, { provider });
}
const getFullSubscriptionLabel = (label) => `metadata.user_labels.${label}`;
exports.getFullSubscriptionLabel = getFullSubscriptionLabel;
const getPubSubUndeliveredMessagesMetric = () => 'pubsub.googleapis.com|subscription|num_undelivered_messages';
exports.getPubSubUndeliveredMessagesMetric = getPubSubUndeliveredMessagesMetric;
const getMemoryAndCpuMetrics = (cpuUtilization = 70, memoryUtilization = cpuUtilization) => [
    {
        type: 'Resource',
        resource: {
            name: 'cpu',
            target: {
                type: 'Utilization',
                averageUtilization: cpuUtilization,
            },
        },
    },
    {
        type: 'Resource',
        resource: {
            name: 'memory',
            target: {
                type: 'Utilization',
                averageUtilization: memoryUtilization,
            },
        },
    },
];
exports.getMemoryAndCpuMetrics = getMemoryAndCpuMetrics;
/**
 * @deprecated Use createAndBindK8sServiceAccount instead
 */
const bindK8sServiceAccountToGCP = (resourcePrefix, name, namespace, serviceAccount, provider) => {
    const k8sServiceAccount = createK8sServiceAccountFromGCPServiceAccount(`${resourcePrefix}k8s-sa`, name, namespace, serviceAccount, provider);
    new gcp.serviceaccount.IAMBinding(`${resourcePrefix}k8s-iam-binding`, {
        role: 'roles/iam.workloadIdentityUser',
        serviceAccountId: serviceAccount.id,
        members: [k8sServiceAccountToIdentity(k8sServiceAccount)],
    });
    return k8sServiceAccount;
};
exports.bindK8sServiceAccountToGCP = bindK8sServiceAccountToGCP;
const gracefulTerminationHook = (delay = 15) => ({
    preStop: {
        exec: {
            command: ['/bin/bash', '-c', `sleep ${delay}`],
        },
    },
});
exports.gracefulTerminationHook = gracefulTerminationHook;
const getSpotSettings = (spot = { enabled: false, weight: constants_1.defaultSpotWeight, required: false }, isAdhocEnv) => {
    var _a;
    const tolerations = [];
    const affinity = {};
    if ((spot === null || spot === void 0 ? void 0 : spot.enabled) && !isAdhocEnv) {
        const spotWeight = (_a = spot === null || spot === void 0 ? void 0 : spot.weight) !== null && _a !== void 0 ? _a : constants_1.defaultSpotWeight;
        const nonSpotWeight = Math.max(1, 100 - spotWeight);
        tolerations.push({
            key: 'spot',
            operator: 'Equal',
            value: 'true',
            effect: 'NoSchedule',
        });
        affinity.nodeAffinity = spot.required
            ? {
                requiredDuringSchedulingIgnoredDuringExecution: {
                    nodeSelectorTerms: [
                        {
                            matchExpressions: [
                                {
                                    key: kubernetes_1.NodeLabels.Spot.key,
                                    operator: 'In',
                                    values: [kubernetes_1.NodeLabels.Spot.value],
                                },
                            ],
                        },
                    ],
                },
            }
            : {
                preferredDuringSchedulingIgnoredDuringExecution: [
                    {
                        weight: spotWeight,
                        preference: {
                            matchExpressions: [
                                {
                                    key: kubernetes_1.NodeLabels.Spot.key,
                                    operator: 'Exists',
                                },
                            ],
                        },
                    },
                    {
                        weight: nonSpotWeight,
                        preference: {
                            matchExpressions: [
                                {
                                    key: kubernetes_1.NodeLabels.Spot.key,
                                    operator: 'DoesNotExist',
                                },
                            ],
                        },
                    },
                ],
            };
    }
    return { tolerations, affinity };
};
exports.getSpotSettings = getSpotSettings;
const createAutoscaledApplication = ({ name, namespace, version, serviceAccount, containers, minReplicas = 2, maxReplicas, metrics, resourcePrefix = '', deploymentDependsOn = [], podSpec, podAnnotations, labels: extraLabels, shouldCreatePDB = false, provider, isAdhocEnv, strategy, spot, }) => {
    const labels = Object.assign({ app: name }, extraLabels);
    const versionLabels = Object.assign(Object.assign({}, labels), { version });
    const { tolerations, affinity } = (0, exports.getSpotSettings)(spot, isAdhocEnv);
    const deployment = new k8s.apps.v1.Deployment(`${resourcePrefix}deployment`, {
        metadata: {
            name,
            namespace: namespace,
            labels: versionLabels,
        },
        spec: {
            selector: { matchLabels: labels },
            strategy,
            template: {
                metadata: { labels, annotations: podAnnotations },
                spec: Object.assign({ containers, serviceAccountName: serviceAccount === null || serviceAccount === void 0 ? void 0 : serviceAccount.metadata.name, tolerations, affinity: (spot === null || spot === void 0 ? void 0 : spot.enabled) ? affinity : undefined }, podSpec),
            },
        },
    }, {
        dependsOn: deploymentDependsOn,
        provider,
    });
    if (!isAdhocEnv) {
        const targetRef = getTargetRef(name);
        new k8s.autoscaling.v2.HorizontalPodAutoscaler(`${resourcePrefix}hpa`, {
            metadata: {
                name,
                namespace: namespace,
                labels,
                annotations: {
                    'pulumi.com/patchForce': 'true',
                },
            },
            spec: {
                minReplicas,
                maxReplicas: maxReplicas,
                metrics,
                scaleTargetRef: targetRef,
            },
        }, { provider });
        if (shouldCreatePDB) {
            new k8s.policy.v1.PodDisruptionBudget(`${resourcePrefix}pdb`, {
                metadata: {
                    name,
                    namespace: namespace,
                    labels,
                },
                spec: {
                    maxUnavailable: 1,
                    selector: {
                        matchLabels: labels,
                    },
                },
            }, { provider });
        }
    }
    return { labels, deployment };
};
exports.createAutoscaledApplication = createAutoscaledApplication;
const createAutoscaledExposedApplication = (_a) => {
    var { enableCdn = false, serviceTimeout, shouldCreatePDB = true, provider, serviceType = 'ClusterIP', strategy = {
        type: 'RollingUpdate',
        rollingUpdate: {
            maxUnavailable: 1,
        },
    }, backendConfig, servicePorts = [] } = _a, args = __rest(_a, ["enableCdn", "serviceTimeout", "shouldCreatePDB", "provider", "serviceType", "strategy", "backendConfig", "servicePorts"]);
    const { resourcePrefix = '', name, namespace } = args;
    const returnObj = (0, exports.createAutoscaledApplication)(Object.assign(Object.assign({}, args), { shouldCreatePDB,
        provider,
        strategy }));
    const { labels } = returnObj;
    const annotations = {};
    if (enableCdn || serviceTimeout || backendConfig) {
        const spec = {};
        if (enableCdn) {
            spec.cdn = {
                enabled: true,
                cachePolicy: {
                    includeHost: true,
                    includeProtocol: true,
                    includeQueryString: true,
                },
            };
        }
        if (serviceTimeout) {
            spec.timeoutSec = serviceTimeout;
        }
        (0, pulumi_1.all)([backendConfig]).apply(([backendConfig]) => {
            if (backendConfig === null || backendConfig === void 0 ? void 0 : backendConfig.customResponseHeaders) {
                spec.customResponseHeaders = {
                    headers: backendConfig.customResponseHeaders,
                };
            }
            if (backendConfig === null || backendConfig === void 0 ? void 0 : backendConfig.customRequestHeaders) {
                spec.customRequestHeaders = {
                    headers: backendConfig.customRequestHeaders,
                };
            }
        });
        const config = new k8s.apiextensions.CustomResource(`${resourcePrefix}backend-config`, {
            apiVersion: 'cloud.google.com/v1',
            kind: 'BackendConfig',
            metadata: {
                name,
                namespace,
                labels,
            },
            spec,
        }, { provider });
        annotations['cloud.google.com/backend-config'] = config.metadata.name.apply((name) => `{"default": "${name}"}`);
    }
    const ports = servicePorts.length > 0
        ? servicePorts
        : [{ port: 80, targetPort: 'http', protocol: 'TCP', name: 'http' }];
    const service = new k8s.core.v1.Service(`${resourcePrefix}service`, {
        metadata: {
            name,
            namespace,
            labels,
            annotations,
        },
        spec: {
            type: serviceType,
            ports,
            selector: labels,
        },
    }, { provider, dependsOn: [returnObj.deployment] });
    return Object.assign(Object.assign({}, returnObj), { service });
};
exports.createAutoscaledExposedApplication = createAutoscaledExposedApplication;
function createKubernetesSecretFromRecord({ data, resourceName, name, namespace, provider, }) {
    return new k8s.core.v1.Secret(resourceName, {
        metadata: {
            name,
            namespace,
            labels: {
                app: name,
            },
        },
        stringData: Object.keys(data).reduce((acc, key) => (Object.assign(Object.assign({}, acc), { [(0, utils_1.camelToUnderscore)(key)]: (0, pulumi_1.interpolate) `${data[key]}` })), {}),
    }, { provider });
}
