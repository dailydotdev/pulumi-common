import { Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
export declare type Cron = {
    name: string;
    endpoint?: string;
    schedule: string;
    headers?: Record<string, string>;
    body?: string;
};
export declare function createCronJobs(name: string, crons: Cron[], serviceUrl: Output<string>): gcp.cloudscheduler.Job[];
