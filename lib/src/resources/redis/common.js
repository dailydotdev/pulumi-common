"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurePriorityClass = exports.configureResources = exports.configurePersistence = exports.configureConfiguration = exports.defaultImage = exports.defaultModules = void 0;
const pulumi_1 = require("@pulumi/pulumi");
/**
 * Default modules to load in the Redis configuration.
 */
exports.defaultModules = [
    '/opt/redis-stack/lib/redisearch.so',
    '/opt/redis-stack/lib/rejson.so',
];
exports.defaultImage = {
    repository: 'redis/redis-stack-server',
    tag: '7.2.0-v10',
};
const configureConfiguration = (args) => {
    return (0, pulumi_1.all)([args.modules, args.configuration]).apply(([modules = exports.defaultModules, configuration = '']) => {
        let configurationString = configuration;
        modules.forEach((module) => {
            configurationString += `\nloadmodule ${module}`;
        });
        return configurationString;
    });
};
exports.configureConfiguration = configureConfiguration;
const configurePersistence = (args) => {
    return (0, pulumi_1.all)([args.memorySizeGb, args.storageSizeGb, args.persistence]).apply(([memorySizeGb, storageSizeGb, persistence]) => {
        const defaultStorageSize = Math.max(10, memorySizeGb * 2);
        const storageSize = storageSizeGb || defaultStorageSize;
        if (memorySizeGb > storageSize) {
            throw new Error('Storage size must be greater than memory size');
        }
        return Object.assign(Object.assign({ storageClass: 'standard-rwo' }, persistence), { size: `${storageSize}Gi` });
    });
};
exports.configurePersistence = configurePersistence;
const configureResources = (args) => {
    return (0, pulumi_1.all)([args.isAdhocEnv, args.cpuSize, args.memorySizeGb]).apply(([isAdhocEnv, cpuSize, memorySizeGb]) => {
        return isAdhocEnv
            ? undefined
            : {
                requests: {
                    cpu: cpuSize || '1000m',
                    memory: `${memorySizeGb}Gi`,
                },
                limits: {
                    memory: `${Math.round(memorySizeGb * 1024 * 1.1)}Mi`,
                },
            };
    });
};
exports.configureResources = configureResources;
const configurePriorityClass = (args) => {
    return (0, pulumi_1.all)([
        args.isAdhocEnv,
        args.priorityClass,
        args.priorityClassName,
    ]).apply(([isAdhocEnv, priorityClass, priorityClassName]) => {
        if (isAdhocEnv) {
            return undefined;
        }
        return priorityClass ? priorityClass.name : priorityClassName;
    });
};
exports.configurePriorityClass = configurePriorityClass;
