"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCronJobs = void 0;
const gcp = require("@pulumi/gcp");
const cloudRun_1 = require("./cloudRun");
function createCronJobs(name, crons, serviceUrl) {
    const cloudRunPubSubInvoker = cloudRun_1.getCloudRunPubSubInvoker();
    return crons.map((cron) => {
        const uri = serviceUrl.apply((url) => { var _a; return `${url}/${(_a = cron.endpoint) !== null && _a !== void 0 ? _a : cron.name}`; });
        return new gcp.cloudscheduler.Job(`${name}-job-${cron.name}`, {
            name: `${name}-${cron.name}`,
            schedule: cron.schedule,
            httpTarget: {
                uri,
                httpMethod: 'POST',
                oidcToken: {
                    serviceAccountEmail: cloudRunPubSubInvoker.email,
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
exports.createCronJobs = createCronJobs;
