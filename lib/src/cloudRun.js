"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudRunAccess = void 0;
exports.getCloudRunPubSubInvoker = getCloudRunPubSubInvoker;
exports.createCloudRunService = createCloudRunService;
const gcp = require("@pulumi/gcp");
const config_1 = require("./config");
const serviceAccount_1 = require("./serviceAccount");
function getCloudRunPubSubInvoker(infra) {
    return infra.getOutput('cloudRunPubSubInvoker');
}
var CloudRunAccess;
(function (CloudRunAccess) {
    CloudRunAccess[CloudRunAccess["Public"] = 1] = "Public";
    CloudRunAccess[CloudRunAccess["PubSub"] = 2] = "PubSub";
})(CloudRunAccess || (exports.CloudRunAccess = CloudRunAccess = {}));
function createCloudRunService(name, image, envs, limits, vpcConnector, serviceAccount, opts) {
    var _a;
    const additionalAnnotations = (_a = opts === null || opts === void 0 ? void 0 : opts.annotations) !== null && _a !== void 0 ? _a : {};
    if (opts === null || opts === void 0 ? void 0 : opts.minScale) {
        additionalAnnotations['autoscaling.knative.dev/minScale'] =
            opts.minScale.toString();
    }
    if (opts === null || opts === void 0 ? void 0 : opts.ingress) {
        additionalAnnotations['run.googleapis.com/ingress'] = opts.ingress;
    }
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
                        args: opts === null || opts === void 0 ? void 0 : opts.args,
                    },
                ],
                containerConcurrency: opts === null || opts === void 0 ? void 0 : opts.concurrency,
            },
        },
    }, { dependsOn: opts === null || opts === void 0 ? void 0 : opts.dependsOn });
    if ((opts === null || opts === void 0 ? void 0 : opts.access) && (opts === null || opts === void 0 ? void 0 : opts.iamMemberName)) {
        const member = opts.access === CloudRunAccess.Public
            ? 'allUsers'
            : (0, serviceAccount_1.serviceAccountToMember)(getCloudRunPubSubInvoker(opts.infra));
        new gcp.cloudrun.IamMember(opts.iamMemberName, {
            service: service.name,
            location: config_1.location,
            role: 'roles/run.invoker',
            member,
        });
    }
    return service;
}
