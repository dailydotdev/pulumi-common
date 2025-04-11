import { Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
type Cron = {
    name: string;
    schedule: string;
    body?: string;
};
export type CronPubSub = Cron & {
    topic?: string;
};
export type CronHttp = Cron & {
    endpoint?: string;
    headers?: Record<string, string>;
};
export declare function createCronJobs(name: string, crons: CronHttp[], serviceUrl: Output<string>, serviceAccount: Output<gcp.serviceaccount.Account>): gcp.cloudscheduler.Job[];
export declare function createPubSubCronJobs(name: string, crons: CronPubSub[]): gcp.cloudscheduler.Job[];
export {};
