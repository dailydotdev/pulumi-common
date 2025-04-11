"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscriptionsFromWorkers = createSubscriptionsFromWorkers;
exports.addLabelsToWorkers = addLabelsToWorkers;
const stream_1 = require("./resources/stream");
function createSubscriptionsFromWorkers(name, isAdhocEnv, workers, { serviceUrl, dependsOn, serviceAccount, } = {}) {
    if (!serviceAccount && serviceUrl) {
        throw new Error('service account must be provided');
    }
    return workers.map((worker) => {
        var _a;
        return new stream_1.StreamSubscription(`${name}-sub-${worker.subscription}`, Object.assign({ isAdhocEnv, topic: worker.topic, name: worker.subscription, pushConfig: serviceUrl
                ? {
                    pushEndpoint: serviceUrl.apply((url) => { var _a; return `${url}/${(_a = worker.endpoint) !== null && _a !== void 0 ? _a : worker.subscription}`; }),
                    oidcToken: {
                        serviceAccountEmail: (_a = serviceAccount === null || serviceAccount === void 0 ? void 0 : serviceAccount.email) !== null && _a !== void 0 ? _a : '',
                    },
                }
                : undefined, retryPolicy: {
                minimumBackoff: '1s',
                maximumBackoff: '60s',
            } }, worker.args), {
            dependsOn,
        });
    });
}
function addLabelsToWorkers(workers, labels) {
    return workers.map((worker) => (Object.assign(Object.assign({}, worker), { args: Object.assign(Object.assign({}, worker.args), { labels }) })));
}
