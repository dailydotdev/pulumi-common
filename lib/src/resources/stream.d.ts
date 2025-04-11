import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
export type StreamArgs = gcp.pubsub.TopicArgs & {
    isAdhocEnv: boolean;
};
export declare class Stream {
    private readonly topicName;
    readonly resource: pulumi.Resource;
    readonly id: pulumi.Output<string>;
    constructor(name: string, args: StreamArgs, opts?: pulumi.CustomResourceOptions);
    get name(): pulumi.Output<string>;
}
export type StreamSubscriptionArgs = gcp.pubsub.SubscriptionArgs & {
    isAdhocEnv: boolean;
};
export declare class StreamSubscription {
    private readonly subName;
    private readonly topicName;
    readonly resource: pulumi.Resource;
    constructor(name: string, args: StreamSubscriptionArgs, opts?: pulumi.CustomResourceOptions);
    get name(): pulumi.Output<string>;
    get topic(): pulumi.Output<string>;
}
