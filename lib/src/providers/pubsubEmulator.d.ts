import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
export declare class PubsubEmulatorTopic extends pulumi.dynamic.Resource {
    constructor(name: string, props: gcp.pubsub.TopicArgs, opts?: pulumi.CustomResourceOptions);
}
export declare class PubsubEmulatorSubscription extends pulumi.dynamic.Resource {
    constructor(name: string, props: gcp.pubsub.SubscriptionArgs, opts?: pulumi.CustomResourceOptions);
}
