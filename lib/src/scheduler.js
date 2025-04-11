"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCronJobs = createCronJobs;
exports.createPubSubCronJobs = createPubSubCronJobs;
const gcp = require("@pulumi/gcp");
function createCronJobs(name, crons, serviceUrl, serviceAccount) {
    return crons.map((cron) => {
        const uri = serviceUrl.apply((url) => { var _a; return `${url}/${(_a = cron.endpoint) !== null && _a !== void 0 ? _a : cron.name}`; });
        return new gcp.cloudscheduler.Job(`${name}-job-${cron.name}`, {
            name: `${name}-${cron.name}`,
            schedule: cron.schedule,
            httpTarget: {
                uri,
                httpMethod: 'POST',
                oidcToken: {
                    serviceAccountEmail: serviceAccount.email,
                    audience: uri,
                },
                headers: cron.headers,
                body: cron.body
                    ? Buffer.from(cron.body, 'utf8').toString('base64')
                    : undefined,
            },
        });
    });
}
const mapUnique = (array, callback) => Array.from(new Set(array)).map(callback);
function createPubSubCronJobs(name, crons) {
    const { project } = gcp.config;
    const topics = mapUnique(crons.map((cron) => cron.topic || cron.name), (topic) => new gcp.pubsub.Topic(`${name}-cron-topic-${topic}`, {
        name: topic,
    }));
    return crons.map((cron) => {
        var _a;
        return new gcp.cloudscheduler.Job(`${name}-job-${cron.name}`, {
            name: `${name}-${cron.name}`,
            schedule: cron.schedule,
            pubsubTarget: {
                data: Buffer.from((_a = cron.body) !== null && _a !== void 0 ? _a : '{}', 'utf8').toString('base64'),
                topicName: `projects/${project}/topics/${cron.topic || cron.name}`,
            },
        }, { dependsOn: topics });
    });
}
