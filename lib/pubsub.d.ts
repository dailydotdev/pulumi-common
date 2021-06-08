import { Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
export declare type Worker = {
    topic: string;
    subscription: string;
};
export declare function createSubscriptionsFromWorkers(name: string, workers: Worker[], serviceUrl: Output<string>): gcp.pubsub.Subscription[];
