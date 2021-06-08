"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscriptionsFromWorkers = void 0;
const gcp = require("@pulumi/gcp");
const cloudRun_1 = require("./cloudRun");
function createSubscriptionsFromWorkers(name, workers, serviceUrl) {
    const cloudRunPubSubInvoker = cloudRun_1.getCloudRunPubSubInvoker();
    return workers.map((worker) => new gcp.pubsub.Subscription(`${name}-sub-${worker.subscription}`, {
        topic: worker.topic,
        name: worker.subscription,
        pushConfig: {
            pushEndpoint: serviceUrl.apply((url) => `${url}/${worker.subscription}`),
            oidcToken: {
                serviceAccountEmail: cloudRunPubSubInvoker.email,
            },
        },
        retryPolicy: {
            minimumBackoff: '10s',
            maximumBackoff: '600s',
        },
    }));
}
exports.createSubscriptionsFromWorkers = createSubscriptionsFromWorkers;
