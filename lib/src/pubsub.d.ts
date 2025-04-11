import { Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { SubscriptionArgs } from '@pulumi/gcp/pubsub/subscription';
import { Input } from '@pulumi/pulumi/output';
import { Resource } from '@pulumi/pulumi/resource';
import { StreamSubscription } from './resources/stream';
export type Worker = {
    topic: string;
    subscription: string;
    endpoint?: string;
    args?: Partial<SubscriptionArgs>;
};
export declare function createSubscriptionsFromWorkers(name: string, isAdhocEnv: boolean, workers: Worker[], { serviceUrl, dependsOn, serviceAccount, }?: {
    serviceUrl?: Output<string>;
    dependsOn?: Input<Input<Resource>[]> | Input<Resource>;
    serviceAccount?: Output<gcp.serviceaccount.Account>;
}): StreamSubscription[];
export declare function addLabelsToWorkers(workers: Worker[], labels: Input<{
    [key: string]: Input<string>;
}>): Worker[];
