"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployDebeziumSharedDependencies = deployDebeziumSharedDependencies;
exports.deployDebeziumKubernetesResources = deployDebeziumKubernetesResources;
const gcp = require("@pulumi/gcp");
const k8s = require("@pulumi/kubernetes");
const crypto_1 = require("crypto");
const serviceAccount_1 = require("./serviceAccount");
const v1_1 = require("@pulumi/kubernetes/core/v1");
const utils_1 = require("./utils");
const k8s_1 = require("./k8s");
/**
 * Deploys only the shared dependencies for Debezium.
 * This is the service account.
 */
function deployDebeziumSharedDependencies({ name, resourcePrefix = '', isAdhocEnv, }) {
    if (isAdhocEnv) {
        return {};
    }
    const { serviceAccount: debeziumSa } = (0, serviceAccount_1.createServiceAccountAndGrantRoles)(`${resourcePrefix}debezium-sa`, `${name}-debezium`, `${name}-debezium`, [
        { name: 'publisher', role: 'roles/pubsub.publisher' },
        { name: 'viewer', role: 'roles/pubsub.viewer' },
    ], isAdhocEnv);
    const debeziumKey = new gcp.serviceaccount.Key(`${resourcePrefix}debezium-sa-key`, {
        serviceAccountId: (debeziumSa === null || debeziumSa === void 0 ? void 0 : debeziumSa.accountId) || '',
    });
    return { debeziumSa, debeziumKey };
}
/**
 * Deploys only the Kubernetes resources for Debezium
 */
function deployDebeziumKubernetesResources(name, namespace, debeziumPropsString, debeziumKey, { limits: requests = {
    cpu: '1',
    memory: '1024Mi',
}, env = [], image = 'debezium/server:1.6', resourcePrefix = '', provider, isAdhocEnv, disableHealthCheck, affinity, version, } = {}) {
    const propsHash = debeziumPropsString.apply((props) => (0, crypto_1.createHash)('md5').update(props).digest('hex'));
    const debeziumProps = new k8s.core.v1.Secret(`${resourcePrefix}debezium-props`, {
        metadata: {
            name: `${name}-debezium-props`,
            namespace,
        },
        data: {
            'application.properties': debeziumPropsString.apply((str) => Buffer.from(str).toString('base64')),
        },
    }, { provider });
    const labels = {
        parent: name,
        app: 'debezium',
    };
    const volumes = [
        {
            name: 'props',
            secret: {
                secretName: debeziumProps.metadata.name,
            },
        },
        {
            name: 'config',
            emptyDir: {},
        },
    ];
    const volumeMounts = [
        {
            name: 'config',
            mountPath: (version === null || version === void 0 ? void 0 : version.startsWith('3'))
                ? '/debezium/config'
                : '/debezium/conf',
        },
    ];
    const initContainers = [
        {
            name: 'copy-config',
            image,
            command: [
                'sh',
                '-c',
                `cp /props/application.properties /config/application.properties; cp -r /debezium/${(version === null || version === void 0 ? void 0 : version.startsWith('3')) ? 'config' : 'conf'}/* /config/`,
            ],
            volumeMounts: [
                { name: 'props', mountPath: '/props' },
                { name: 'config', mountPath: '/config' },
            ],
        },
    ];
    // If service account is provided
    if (debeziumKey) {
        const debeziumSecretSa = new k8s.core.v1.Secret(`${resourcePrefix}debezium-secret-sa`, {
            metadata: {
                name: `${name}-debezium-sa`,
                namespace,
            },
            data: {
                'key.json': (debeziumKey === null || debeziumKey === void 0 ? void 0 : debeziumKey.privateKey) || '',
            },
        }, { provider });
        volumes.push({
            name: 'service-account-key',
            secret: {
                secretName: debeziumSecretSa.metadata.name,
            },
        });
        volumeMounts.push({
            name: 'service-account-key',
            mountPath: '/var/secrets/google',
        });
    }
    let livenessProbe;
    if (!disableHealthCheck) {
        livenessProbe = {
            httpGet: { path: '/q/health', port: 'http' },
            initialDelaySeconds: 60,
            periodSeconds: 30,
        };
    }
    if (!isAdhocEnv) {
        const pvc = new v1_1.PersistentVolumeClaim(`${resourcePrefix}debezium-pvc`, {
            metadata: {
                name: `${name}-debezium-data`,
                namespace,
                labels: Object.assign({}, labels),
            },
            spec: {
                accessModes: ['ReadWriteOnce'],
                resources: {
                    requests: {
                        storage: '4Gi',
                    },
                },
                storageClassName: 'hyperdisk-balanced-retain',
            },
        }, { provider, dependsOn: [] });
        volumes.push({
            name: 'data',
            persistentVolumeClaim: {
                claimName: pvc.metadata.name,
            },
        });
        volumeMounts.push({ name: 'data', mountPath: '/debezium/data' });
    }
    const { tolerations } = (0, k8s_1.getSpotSettings)({ enabled: true }, isAdhocEnv);
    new k8s.apps.v1.Deployment(`${resourcePrefix}debezium-deployment`, {
        metadata: {
            name: `${name}-debezium`,
            namespace,
        },
        spec: {
            replicas: 1,
            strategy: {
                type: 'Recreate',
            },
            selector: { matchLabels: labels },
            template: {
                metadata: {
                    labels: Object.assign(Object.assign({}, labels), { props: propsHash }),
                },
                spec: {
                    volumes,
                    initContainers,
                    affinity: !isAdhocEnv ? affinity : undefined,
                    tolerations,
                    securityContext: {
                        runAsUser: 185,
                        runAsGroup: 185,
                        fsGroup: 185,
                    },
                    containers: [
                        {
                            name: 'debezium',
                            image,
                            ports: [
                                { name: 'http', containerPort: 8080 },
                                { name: 'metrics', containerPort: 9404 },
                            ],
                            volumeMounts,
                            env: [
                                {
                                    name: 'GOOGLE_APPLICATION_CREDENTIALS',
                                    value: '/var/secrets/google/key.json',
                                },
                                {
                                    name: 'JMX_EXPORTER_PORT',
                                    value: '9404',
                                },
                                ...env,
                            ],
                            resources: !isAdhocEnv
                                ? {
                                    limits: (0, utils_1.stripCpuFromLimits)(requests),
                                    requests,
                                }
                                : undefined,
                            livenessProbe,
                        },
                    ],
                },
            },
        },
    }, { provider });
}
