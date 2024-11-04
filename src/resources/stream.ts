import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import {
  PubsubEmulatorSubscription,
  PubsubEmulatorTopic,
} from '../providers/pubsubEmulator';

export type StreamArgs = gcp.pubsub.TopicArgs & { isAdhocEnv: boolean };

export class Stream {
  private readonly topicName: pulumi.Input<string>;
  public readonly resource: pulumi.Resource;

  constructor(
    name: string,
    args: StreamArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    this.topicName = args.name as pulumi.Input<string>;
    if (args.isAdhocEnv) {
      this.resource = new PubsubEmulatorTopic(name, args, opts);
    } else {
      this.resource = new gcp.pubsub.Topic(name, args, opts);
    }
  }

  get name(): pulumi.Output<string> {
    return pulumi.interpolate`${this.topicName}`;
  }
}

export type StreamSubscriptionArgs = gcp.pubsub.SubscriptionArgs & {
  isAdhocEnv: boolean;
};

export class StreamSubscription {
  private readonly subName: pulumi.Input<string>;
  private readonly topicName: pulumi.Input<string>;
  public readonly resource: pulumi.Resource;

  constructor(
    name: string,
    args: StreamSubscriptionArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    this.subName = args.name as pulumi.Input<string>;
    this.topicName = args.topic as pulumi.Input<string>;
    if (args.isAdhocEnv) {
      this.resource = new PubsubEmulatorSubscription(name, args, opts);
    } else {
      this.resource = new gcp.pubsub.Subscription(name, args, opts);
    }
  }

  get name(): pulumi.Output<string> {
    return pulumi.interpolate`${this.subName}`;
  }

  get topic(): pulumi.Output<string> {
    return pulumi.interpolate`${this.topicName}`;
  }
}
