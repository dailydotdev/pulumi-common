"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMigrationJob = exports.createK8sServiceAccountFromGCPServiceAccount = exports.k8sServiceAccountToIdentity = void 0;
const k8s = require("@pulumi/kubernetes");
const gcp = require("@pulumi/gcp");
function k8sServiceAccountToIdentity(serviceAccount) {
    return serviceAccount.metadata.apply((metadata) => `serviceAccount:${gcp.config.project}.svc.id.goog[${metadata.namespace}/${metadata.name}]`);
}
exports.k8sServiceAccountToIdentity = k8sServiceAccountToIdentity;
function createK8sServiceAccountFromGCPServiceAccount(resourceName, name, namespace, serviceAccount) {
    return new k8s.core.v1.ServiceAccount(resourceName, {
        metadata: {
            namespace,
            name,
            annotations: {
                'iam.gke.io/gcp-service-account': serviceAccount.email,
            },
        },
    });
}
exports.createK8sServiceAccountFromGCPServiceAccount = createK8sServiceAccountFromGCPServiceAccount;
function createMigrationJob(name, namespace, image, args, env, serviceAccount) {
    return new k8s.batch.v1.Job(name, {
        metadata: {
            name,
            namespace,
        },
        spec: {
            completions: 1,
            template: {
                spec: {
                    containers: [
                        {
                            name: 'app',
                            image,
                            args,
                            env,
                        },
                    ],
                    serviceAccountName: serviceAccount.metadata.name,
                    restartPolicy: 'Never',
                },
            },
        },
    }, { deleteBeforeReplace: true });
}
exports.createMigrationJob = createMigrationJob;
