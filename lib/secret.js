"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEnvVarsFromSecret = exports.createEncryptedEnvVar = void 0;
const pulumi = require("@pulumi/pulumi");
const gcp = require("@pulumi/gcp");
const utils_1 = require("./utils");
const config_1 = require("./config");
function createEncryptedEnvVar(prefix, key, value) {
    const secret = new gcp.secretmanager.Secret(`${prefix}-secret-${key}`, {
        secretId: `${prefix}-secret-${key}`,
        replication: { automatic: true },
    });
    const version = new gcp.secretmanager.SecretVersion(`${prefix}-sv-${key}`, {
        enabled: true,
        secret: secret.name,
        secretData: value,
    });
    return {
        name: utils_1.camelToUnderscore(key),
        value: pulumi
            .all([secret.secretId, version.id])
            .apply(([name, version]) => `gcp:///${name}/${version.split('/').reverse()[0]}`),
    };
}
exports.createEncryptedEnvVar = createEncryptedEnvVar;
function createEnvVarsFromSecret(prefix) {
    const envVars = config_1.config.requireObject('env');
    return Object.keys(envVars).map((key) => createEncryptedEnvVar(prefix, key, envVars[key]));
}
exports.createEnvVarsFromSecret = createEnvVarsFromSecret;
