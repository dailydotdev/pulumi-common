import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { urnPrefix } from '../constants';
import {
  PubsubEmulatorSubscription,
  PubsubEmulatorTopic,
} from '../providers/pubsubEmulator';

export type StreamArgs = gcp.pubsub.TopicArgs & { isAdhocEnv: boolean };

export class Stream extends pulumi.ComponentResource {
  private readonly instance: gcp.pubsub.Topic | undefined;
  private readonly topicName: pulumi.Input<string>;

  constructor(
    name: string,
    args: StreamArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:Stream`, name, args, opts);

    this.topicName = args.name as pulumi.Input<string>;
    if (args.isAdhocEnv) {
      new PubsubEmulatorTopic(name, args, { ...opts, parent: this });
    } else {
      this.instance = new gcp.pubsub.Topic(name, args, {
        ...opts,
        parent: this,
        aliases: [{ name, parent: pulumi.rootStackResource }],
      });
    }
  }

  get name(): pulumi.Output<string> {
    return pulumi.interpolate`${this.topicName}`;
  }
}

export type StreamSubscriptionArgs = gcp.pubsub.SubscriptionArgs & {
  isAdhocEnv: boolean;
};

export class StreamSubscription extends pulumi.ComponentResource {
  private instance: gcp.pubsub.Subscription | undefined;
  private subName: pulumi.Input<string>;
  private topicName: pulumi.Input<string>;

  constructor(
    name: string,
    args: StreamSubscriptionArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:StreamSubscription`, name, args, opts);

    this.subName = args.name as pulumi.Input<string>;
    this.topicName = args.topic as pulumi.Input<string>;
    if (args.isAdhocEnv) {
      new PubsubEmulatorSubscription(name, args, { ...opts, parent: this });
    } else {
      this.instance = new gcp.pubsub.Subscription(name, args, {
        ...opts,
        parent: this,
        aliases: [{ name, parent: pulumi.rootStackResource }],
      });
    }
  }

  get name(): pulumi.Output<string> {
    return pulumi.interpolate`${this.subName}`;
  }

  get topic(): pulumi.Output<string> {
    return pulumi.interpolate`${this.topicName}`;
  }
}
