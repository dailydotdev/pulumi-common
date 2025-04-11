"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customMetricToK8s = customMetricToK8s;
exports.createAndBindK8sServiceAccount = createAndBindK8sServiceAccount;
exports.deployApplicationSuiteToProvider = deployApplicationSuiteToProvider;
exports.deployApplicationSuite = deployApplicationSuite;
const promises_1 = require("fs/promises");
const pulumi_1 = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");
const gcp = require("@pulumi/gcp");
const k8s_1 = require("../k8s");
const gkeCluster_1 = require("../providers/gkeCluster");
const debezium_1 = require("../debezium");
const utils_1 = require("../utils");
const constants_1 = require("../constants");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
/**
 * Takes a custom definition of an autoscaling metric and turn it into a k8s definition
 */
function customMetricToK8s(metric) {
    var _a;
    switch (metric.type) {
        case 'pubsub':
            // Expand the short label keys to full labels
            const fullLabels = Object.keys(metric.labels).reduce((acc, key) => (Object.assign(Object.assign({}, acc), { [(0, k8s_1.getFullSubscriptionLabel)(key)]: metric.labels[key] })), {});
            return [
                {
                    external: {
                        metric: {
                            name: (0, k8s_1.getPubSubUndeliveredMessagesMetric)(),
                            selector: {
                                matchLabels: fullLabels,
                            },
                        },
                        target: {
                            type: 'AverageValue',
                            averageValue: metric.targetAverageValue.toString(),
                        },
                    },
                    type: 'External',
                },
            ];
        case 'memory_cpu':
            return (0, k8s_1.getMemoryAndCpuMetrics)(metric.cpu, (_a = metric.memory) !== null && _a !== void 0 ? _a : metric.cpu);
    }
}
function createAndBindK8sServiceAccount(resourcePrefix, name, namespace, gcpServiceAccount, provider, shouldBindIamUser) {
    if (gcpServiceAccount) {
        // Create an equivalent k8s service account to an existing gcp service account
        const k8sServiceAccount = (0, k8s_1.createK8sServiceAccountFromGCPServiceAccount)(`${resourcePrefix}k8s-sa`, name, namespace, gcpServiceAccount, provider);
        if (shouldBindIamUser) {
            // Add workloadIdentityUser role to gcp service account
            new gcp.serviceaccount.IAMBinding('k8s-iam-binding', {
                role: 'roles/iam.workloadIdentityUser',
                serviceAccountId: gcpServiceAccount.id,
                members: [(0, k8s_1.k8sServiceAccountToIdentity)(k8sServiceAccount)],
            });
        }
        return k8sServiceAccount;
    }
    return undefined;
}
/**
 * Reads a Debezium properties file and replace the variables with the actual values
 */
function getDebeziumProps(propsPath, propsVars, isAdhocEnv) {
    const func = (vars) => __awaiter(this, void 0, void 0, function* () {
        const props = yield (0, promises_1.readFile)(propsPath, 'utf-8');
        let propsStr = Object.keys(vars).reduce((acc, key) => acc.replace(`%${key}%`, vars[key]), props);
        if (isAdhocEnv) {
            if (!propsStr.includes('debezium.source.topic.prefix')) {
                propsStr +=
                    '\ndebezium.source.topic.prefix=t\ndebezium.source.tombstones.on.delete=false';
            }
            if (!propsStr.includes('quarkus.log.console.json')) {
                propsStr += '\nquarkus.log.console.json=false';
            }
            return `${propsStr}\ndebezium.sink.pubsub.address=pubsub:8085\ndebezium.sink.pubsub.project.id=local`;
        }
        return propsStr;
    });
    return (0, pulumi_1.all)(propsVars).apply(func);
}
function getDefaultSpot(createService) {
    return createService
        ? { enabled: false, weight: constants_1.defaultSpotWeight, required: false }
        : { enabled: true, weight: constants_1.defaultSpotWeight, required: false };
}
/**
 * Deploys a cron job to k8s.
 */
function deployCron({ resourcePrefix, name, namespace, image, provider, containerOpts, serviceAccount, isAdhocEnv, }, { nameSuffix, schedule, concurrencyPolicy = 'Forbid', activeDeadlineSeconds, volumes, volumeMounts, env = [], args, labels = {}, command, limits, requests, dependsOn, spot, suspend = false, }) {
    const appResourcePrefix = `${resourcePrefix}${nameSuffix ? `${nameSuffix}-` : ''}`;
    const appName = `${name}${nameSuffix ? `-${nameSuffix}` : ''}`;
    const { tolerations, affinity } = (0, k8s_1.getSpotSettings)(spot, isAdhocEnv);
    // If the cron job is suspended, we don't want to run it automatically, but we still need to define a schedule
    const cronSchedule = schedule && !suspend ? schedule : '0 0 1 1 *';
    return new k8s.batch.v1.CronJob(`${appResourcePrefix}cron`, {
        metadata: {
            name: appName,
            namespace,
            labels: Object.assign({ app: appName, 'app-type': 'cron' }, labels),
        },
        spec: {
            schedule: cronSchedule,
            suspend,
            concurrencyPolicy,
            successfulJobsHistoryLimit: 3,
            failedJobsHistoryLimit: 3,
            jobTemplate: {
                spec: {
                    activeDeadlineSeconds: activeDeadlineSeconds,
                    template: {
                        metadata: {
                            labels: Object.assign({ app: appName, 'app-type': 'cron' }, labels),
                        },
                        spec: {
                            restartPolicy: 'OnFailure',
                            volumes,
                            serviceAccountName: serviceAccount === null || serviceAccount === void 0 ? void 0 : serviceAccount.metadata.name,
                            containers: [
                                Object.assign(Object.assign({}, containerOpts), { name: 'app', image,
                                    command,
                                    args,
                                    volumeMounts,
                                    env, resources: {
                                        requests: requests !== null && requests !== void 0 ? requests : limits,
                                        limits: (0, utils_1.stripCpuFromLimits)(limits),
                                    } }),
                            ],
                            tolerations,
                            affinity: (spot === null || spot === void 0 ? void 0 : spot.enabled) ? affinity : undefined,
                        },
                    },
                },
            },
        },
    }, { provider, dependsOn });
}
/**
 * Deploys a single deployable unit (application) to k8s.
 * Deployable unit includes the following k8s entities: deployment, hpa, pdb (optional), and service (optional).
 * If the application requires a service, this function will also set a proper lifecycle hook to prevent 5xx on deployment.
 * It also guards against setting a service as NodePort in a VPC native cluster.
 */
function deployApplication({ resourcePrefix, name, namespace, serviceAccount, image, imageTag, containerOpts, provider, isAdhocEnv, }, { nameSuffix, minReplicas = 2, maxReplicas, limits, requests, dependsOn, readinessProbe, livenessProbe = readinessProbe, env = [], createService, serviceType, metric, labels, command, args, enableCdn, serviceTimeout, volumes, volumeMounts, disableLifecycle = true, podAnnotations, isApi = createService, ports = [], servicePorts = [], backendConfig, spot: requestedSpot, }) {
    const shouldCreateService = createService || servicePorts.length > 0;
    const spot = requestedSpot !== null && requestedSpot !== void 0 ? requestedSpot : getDefaultSpot(shouldCreateService);
    const appResourcePrefix = `${resourcePrefix}${nameSuffix ? `${nameSuffix}-` : ''}`;
    const appName = `${name}${nameSuffix ? `-${nameSuffix}` : ''}`;
    const appArgs = {
        resourcePrefix: appResourcePrefix,
        name: appName,
        namespace,
        version: imageTag,
        serviceAccount,
        labels,
        minReplicas,
        maxReplicas,
        metrics: customMetricToK8s(metric),
        podSpec: {
            volumes,
        },
        podAnnotations,
        containers: [
            Object.assign(Object.assign({}, containerOpts), { name: 'app', image,
                command,
                args,
                ports,
                readinessProbe,
                livenessProbe,
                env, resources: !isAdhocEnv
                    ? { requests: requests !== null && requests !== void 0 ? requests : limits, limits: (0, utils_1.stripCpuFromLimits)(limits) }
                    : undefined, lifecycle: isApi && !isAdhocEnv && !disableLifecycle
                    ? (0, k8s_1.gracefulTerminationHook)()
                    : undefined, volumeMounts }),
        ],
        deploymentDependsOn: dependsOn,
        shouldCreatePDB: isApi,
        provider,
        isAdhocEnv,
        ports,
        servicePorts,
        spot,
    };
    if (shouldCreateService) {
        return (0, k8s_1.createAutoscaledExposedApplication)(Object.assign(Object.assign({}, appArgs), { serviceType,
            enableCdn,
            serviceTimeout,
            backendConfig }));
    }
    return (0, k8s_1.createAutoscaledApplication)(appArgs);
}
/**
 * Deploys an application suite to a single provider.
 * An application suite consists of several deployable units (i.e. api, background worker).
 * A suite can also require a migration job and/or a debezium instance.
 */
function deployApplicationSuiteToProvider({ name, namespace, serviceAccount, secrets, additionalSecrets, image, imageTag, apps, provider, resourcePrefix = '', migration, migrations, debezium, crons, shouldBindIamUser, isAdhocEnv, dependsOn: suiteDependsOn, dotEnvFileName = '.env', }) {
    var _a, _b, _c;
    // Create an equivalent k8s service account to an existing gcp service account
    const k8sServiceAccount = createAndBindK8sServiceAccount(resourcePrefix, name, namespace, serviceAccount, provider, shouldBindIamUser);
    const containerOpts = {};
    containerOpts.envFrom = [];
    const secretHashAnnotations = {};
    const dependsOn = suiteDependsOn !== null && suiteDependsOn !== void 0 ? suiteDependsOn : [];
    if (secrets) {
        containerOpts.envFrom.push({ secretRef: { name } });
        // Create the secret object
        const secretK8s = (0, k8s_1.createKubernetesSecretFromRecord)({
            data: secrets,
            resourceName: `${resourcePrefix}k8s-secret`,
            name,
            namespace,
            provider,
        });
        if (isAdhocEnv) {
            secretHashAnnotations[`secret-${name}`] = (0, crypto_1.createHash)('sha256')
                .update(JSON.stringify(secrets))
                .digest('hex');
        }
        dependsOn.push(secretK8s);
    }
    if (additionalSecrets) {
        const additionalSecretK8s = additionalSecrets.map(({ name, data }) => {
            if (isAdhocEnv) {
                secretHashAnnotations[`secret-${name}`] = (0, crypto_1.createHash)('sha256')
                    .update(JSON.stringify(data))
                    .digest('hex');
            }
            return new k8s.core.v1.Secret(`${resourcePrefix}${name}`, {
                metadata: {
                    name,
                    namespace,
                },
                data,
            }, { provider });
        });
        dependsOn.push(...additionalSecretK8s);
    }
    if (isAdhocEnv &&
        !(0, utils_1.isNullOrUndefined)(dotEnvFileName) &&
        (0, fs_1.existsSync)(dotEnvFileName)) {
        const envFile = (0, fs_1.readFileSync)(dotEnvFileName, 'utf-8');
        const envVars = envFile.split('\n').reduce((acc, line) => {
            const trimmedLine = line.trim();
            // Skip empty lines and comment lines
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                return acc;
            }
            const [key, value] = trimmedLine.split('=').map((part) => part.trim());
            if (key && value) {
                acc[key] = Buffer.from(value).toString('base64');
            }
            return acc;
        }, {});
        secretHashAnnotations['secret-dotenv'] = (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(envVars))
            .digest('hex');
        const dotEnvSecret = new k8s.core.v1.Secret(`${resourcePrefix}dotenv`, {
            metadata: {
                name: `${name}-dotenv`,
                namespace,
            },
            data: envVars,
        });
        containerOpts.envFrom.push({ secretRef: { name: `${name}-dotenv` } });
        dependsOn.push(dotEnvSecret);
    }
    // Run migration if needed
    if (migration) {
        const migrationJob = (0, k8s_1.createMigrationJob)(`${name}-migration`, namespace, image, migration.args, containerOpts, k8sServiceAccount, { provider, resourcePrefix, dependsOn }, (_a = migration === null || migration === void 0 ? void 0 : migration.toleratesSpot) !== null && _a !== void 0 ? _a : true);
        dependsOn.push(migrationJob);
    }
    else if (migrations) {
        const jobs = Object.keys(migrations).map((key) => {
            var _a, _b;
            return (0, k8s_1.createMigrationJob)(`${name}-${key}-migration`, namespace, image, migrations[key].args, containerOpts, k8sServiceAccount, { provider, resourcePrefix, dependsOn }, (_b = (_a = migrations[key]) === null || _a === void 0 ? void 0 : _a.toleratesSpot) !== null && _b !== void 0 ? _b : true);
        });
        dependsOn.push(...jobs);
    }
    if (debezium) {
        const propsVars = Object.assign({}, debezium.propsVars);
        if (debezium.topicName) {
            propsVars.topic = debezium.topicName;
        }
        const props = getDebeziumProps(debezium.propsPath, propsVars, isAdhocEnv);
        // IMPORTANT: do not set resource prefix here, otherwise it might create new resources
        const { debeziumKey } = (0, debezium_1.deployDebeziumSharedDependencies)({
            name,
            namespace,
            isAdhocEnv,
        });
        // Useful if we want to migrate Debezium without affecting its dependencies
        if (!debezium.dependenciesOnly) {
            const debeziumDefault = isAdhocEnv ? '2.0' : '1.6';
            (0, debezium_1.deployDebeziumKubernetesResources)(name, namespace, props, debeziumKey, {
                image: `quay.io/debezium/server:${(_b = debezium.version) !== null && _b !== void 0 ? _b : debeziumDefault}`,
                provider,
                resourcePrefix,
                limits: debezium.limits,
                isAdhocEnv,
                env: debezium.env,
                disableHealthCheck: debezium.disableHealthCheck,
                affinity: debezium.affinity,
                version: (_c = debezium.version) !== null && _c !== void 0 ? _c : debeziumDefault,
            });
        }
    }
    const context = {
        resourcePrefix,
        name,
        namespace,
        serviceAccount: k8sServiceAccount,
        containerOpts,
        imageTag,
        image,
        provider,
        isAdhocEnv,
    };
    // Deploy the applications
    const appsRet = apps.map((app) => {
        if (app.port && !app.ports) {
            app.ports = [{ name: 'http', containerPort: app.port, protocol: 'TCP' }];
        }
        return deployApplication(context, Object.assign(Object.assign({}, app), { podAnnotations: Object.assign(Object.assign({}, app.podAnnotations), secretHashAnnotations), dependsOn: [...dependsOn, ...(app.dependsOn || [])] }));
    });
    if (crons) {
        crons.map((cron) => deployCron(context, Object.assign(Object.assign({}, cron), { dependsOn: [...dependsOn, ...(cron.dependsOn || [])] })));
    }
    return appsRet;
}
/**
 * Deploys an application suite to multiple providers based on our best practices
 */
function deployApplicationSuite(suite, vpcNativeProvider) {
    if (suite.isAdhocEnv) {
        const apps = deployApplicationSuiteToProvider(Object.assign(Object.assign({}, suite), { shouldBindIamUser: false }));
        return [apps];
    }
    else {
        // We need to run migration and debezium only on one provider
        const vpcNativeApps = deployApplicationSuiteToProvider(Object.assign(Object.assign({}, suite), { shouldBindIamUser: true, provider: (vpcNativeProvider || (0, gkeCluster_1.getVpcNativeCluster)()).provider, resourcePrefix: 'vpc-native-' }));
        return [vpcNativeApps];
    }
}
