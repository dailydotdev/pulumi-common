"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCloudRunService = exports.CloudRunAccess = exports.getCloudRunPubSubInvoker = void 0;
const gcp = require("@pulumi/gcp");
const config_1 = require("./config");
const serviceAccount_1 = require("./serviceAccount");
function getCloudRunPubSubInvoker() {
    return config_1.infra.getOutput('cloudRunPubSubInvoker');
}
exports.getCloudRunPubSubInvoker = getCloudRunPubSubInvoker;
var CloudRunAccess;
(function (CloudRunAccess) {
    CloudRunAccess[CloudRunAccess["Public"] = 1] = "Public";
    CloudRunAccess[CloudRunAccess["PubSub"] = 2] = "PubSub";
})(CloudRunAccess = exports.CloudRunAccess || (exports.CloudRunAccess = {}));
function createCloudRunService(name, image, envs, limits, vpcConnector, serviceAccount, opts) {
    const additionalAnnotations = (opts === null || opts === void 0 ? void 0 : opts.minScale)
        ? { 'autoscaling.knative.dev/minScale': opts.minScale.toString() }
        : {};
    const service = new gcp.cloudrun.Service(name, {
        name,
        autogenerateRevisionName: true,
        location: config_1.location,
        traffics: [{ latestRevision: true, percent: 100 }],
        template: {
            metadata: {
                annotations: Object.assign({ 'run.googleapis.com/vpc-access-connector': vpcConnector.name, 'run.googleapis.com/vpc-access-egress': 'private-ranges-only' }, additionalAnnotations),
            },
            spec: {
                serviceAccountName: serviceAccount.email,
                containers: [
                    {
                        image,
                        resources: { limits },
                        envs,
                    },
                ],
                containerConcurrency: opts === null || opts === void 0 ? void 0 : opts.concurrency,
            },
        },
    }, { dependsOn: opts === null || opts === void 0 ? void 0 : opts.dependsOn });
    if ((opts === null || opts === void 0 ? void 0 : opts.access) && (opts === null || opts === void 0 ? void 0 : opts.iamMemberName)) {
        const member = opts.access === CloudRunAccess.Public
            ? 'allUsers'
            : serviceAccount_1.serviceAccountToMember(getCloudRunPubSubInvoker());
        new gcp.cloudrun.IamMember(opts.iamMemberName, {
            service: service.name,
            location: config_1.location,
            role: 'roles/run.invoker',
            member,
        });
    }
    return service;
}
exports.createCloudRunService = createCloudRunService;
