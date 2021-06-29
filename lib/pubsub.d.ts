import { Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { SubscriptionArgs } from '@pulumi/gcp/pubsub/subscription';
export declare type Worker = {
    topic: string;
    subscription: string;
    args?: Partial<SubscriptionArgs>;
};
export declare function createSubscriptionsFromWorkers(name: string, workers: Worker[], serviceUrl: Output<string>): gcp.pubsub.Subscription[];
