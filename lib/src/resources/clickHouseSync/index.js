"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClickHouseSync = void 0;
const k8s = require("@pulumi/kubernetes");
const pulumi_1 = require("@pulumi/pulumi");
const constants_1 = require("../../constants");
const kubernetes_1 = require("../../kubernetes");
const utils_1 = require("./utils");
const yaml_1 = require("yaml");
const crypto_1 = require("crypto");
const k8s_1 = require("../../k8s");
const defaults = {
    image: {
        repository: 'altinity/clickhouse-sink-connector',
        digest: 'sha256:1c0db9877331a0aaceb2e0f2838db3a5156a3cfbfdb83a92235b6287b576c5d0',
    },
};
class ClickHouseSync extends pulumi_1.ComponentResource {
    constructor(name, args, resourceOptions) {
        var _a, _b;
        super(`${constants_1.urnPrefix}:ClickHouseSync`, name, args, resourceOptions);
        const isAdhocEnv = args.isAdhocEnv || false;
        const deploymentName = ((_a = args.deployment) === null || _a === void 0 ? void 0 : _a.name) || `${name}-clickhouse-sync`;
        const config = (0, utils_1.loadConfig)(args.props.path, args.props.vars).apply((config) => {
            return Buffer.from((0, yaml_1.stringify)(Object.assign(Object.assign({}, config), args.props.keys))).toString('base64');
        });
        const configChecksum = config.apply((configString) => (0, crypto_1.createHash)('sha256').update(configString).digest('hex'));
        const { tolerations } = (0, k8s_1.getSpotSettings)({ enabled: (_b = args === null || args === void 0 ? void 0 : args.toleratesSpot) !== null && _b !== void 0 ? _b : true }, false);
        this.config = new k8s.core.v1.Secret(`${name}-clickhouse-sync-config`, {
            metadata: {
                namespace: args.namespace,
                name: `${name}-clickhouse-sync-config`,
                labels: Object.assign(Object.assign({}, kubernetes_1.commonLabels), { 'app.kubernetes.io/name': `${name}-clickhouse-sync-config` }),
            },
            data: {
                'config.yml': config,
            },
        }, resourceOptions);
        this.deployment = new k8s.apps.v1.Deployment(`${name}-clickhouse-sync`, {
            metadata: {
                namespace: args.namespace,
                name: deploymentName,
                labels: Object.assign(Object.assign({}, kubernetes_1.commonLabels), { 'app.kubernetes.io/name': deploymentName }),
                annotations: {
                    'chekcsum/secret': configChecksum,
                },
            },
            spec: {
                replicas: 1,
                strategy: {
                    type: 'Recreate',
                },
                selector: {
                    matchLabels: {
                        'app.kubernetes.io/name': deploymentName,
                    },
                },
                template: {
                    metadata: {
                        labels: {
                            'app.kubernetes.io/name': deploymentName,
                        },
                    },
                    spec: {
                        containers: [
                            {
                                name: 'clickhouse-sink-connector',
                                image: (0, kubernetes_1.image)(args.image || defaults.image),
                                // Need to change the command from upstream, as we can't mount the config file directly to root directory
                                command: [
                                    'java',
                                    '-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005',
                                    '-jar',
                                    '/app.jar',
                                    '/config/config.yml',
                                    'com.altinity.clickhouse.debezium.embedded.ClickHouseDebeziumEmbeddedApplication',
                                ],
                                ports: [
                                    {
                                        name: 'healthcheck',
                                        containerPort: 8080,
                                    },
                                ],
                                env: args.env,
                                resources: (0, kubernetes_1.configureResources)({
                                    isAdhocEnv: isAdhocEnv,
                                    resources: args.resources,
                                }),
                                volumeMounts: [
                                    {
                                        name: 'clickhouse-config',
                                        mountPath: '/config',
                                    },
                                ],
                            },
                        ],
                        volumes: [
                            {
                                name: 'clickhouse-config',
                                secret: {
                                    secretName: this.config.metadata.name,
                                },
                            },
                        ],
                        tolerations: tolerations,
                    },
                },
            },
        }, resourceOptions);
    }
}
exports.ClickHouseSync = ClickHouseSync;
__exportStar(require("./utils"), exports);
