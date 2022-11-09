import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { PubSub, ServiceError } from '@google-cloud/pubsub';
import { Status } from '@grpc/grpc-js/build/src/constants';
import * as resource from '@pulumi/pulumi/resource';
import { config } from '../config';

const PUBSUB_LOCAL_URL = config.get<string>('pubsubUrl') || 'localhost:8085';
const PUBSUB_LOCAL_PROJECT = config.get<string>('pubsubProjectId') || 'local';
let _pubsub: PubSub;

function getPubsub(): PubSub {
  if (!_pubsub) {
    _pubsub = new PubSub({
      apiEndpoint: PUBSUB_LOCAL_URL,
      projectId: PUBSUB_LOCAL_PROJECT,
    });
  }
  return _pubsub;
}

class PubsubEmulatorTopicProvider implements pulumi.dynamic.ResourceProvider {
  async create({
    name: nameInput,
  }: gcp.pubsub.TopicArgs): Promise<pulumi.dynamic.CreateResult> {
    const name = (await nameInput) as string;
    const pubsub = getPubsub();
    const topic = pubsub.topic(name);
    try {
      await topic.create();
    } catch (err) {
      if ((err as ServiceError)?.code !== Status.ALREADY_EXISTS) {
        throw err;
      }
    }
    return { id: name };
  }

  async update(
    id: resource.ID,
    olds: gcp.pubsub.TopicArgs,
    news: gcp.pubsub.TopicArgs,
  ): Promise<pulumi.dynamic.UpdateResult> {
    await this.create(news);
    return {};
  }

  async diff(id: pulumi.ID): Promise<pulumi.dynamic.DiffResult> {
    const pubsub = getPubsub();
    const exists = await pubsub.topic(id).exists();
    if (exists[0]) {
      return { changes: false };
    }
    return { changes: true };
  }
}

class PubsubEmulatorSubscriptionProvider
  implements pulumi.dynamic.ResourceProvider
{
  async create({
    name: nameInput,
    topic: topicInput,
  }: gcp.pubsub.SubscriptionArgs): Promise<pulumi.dynamic.CreateResult> {
    const name = (await nameInput) as string;
    const topicName = (await topicInput) as string;
    try {
      const pubsub = getPubsub();
      const topic = pubsub.topic(topicName);
      await topic.createSubscription(name);
    } catch (err) {
      if ((err as ServiceError)?.code !== Status.ALREADY_EXISTS) {
        throw err;
      }
    }
    return { id: name };
  }

  async update(
    id: resource.ID,
    olds: gcp.pubsub.SubscriptionArgs,
    news: gcp.pubsub.SubscriptionArgs,
  ): Promise<pulumi.dynamic.UpdateResult> {
    await this.create(news);
    return {};
  }

  async diff(id: pulumi.ID): Promise<pulumi.dynamic.DiffResult> {
    const pubsub = getPubsub();
    const exists = await pubsub.subscription(id).exists();
    if (exists[0]) {
      return { changes: false };
    }
    return { changes: true };
  }
}

const pubsubTopicProvider = new PubsubEmulatorTopicProvider();
const pubsubSubscriptionProvider = new PubsubEmulatorSubscriptionProvider();

export class PubsubEmulatorTopic extends pulumi.dynamic.Resource {
  constructor(
    name: string,
    props: gcp.pubsub.TopicArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(pubsubTopicProvider, name, props, opts);
  }
}

export class PubsubEmulatorSubscription extends pulumi.dynamic.Resource {
  constructor(
    name: string,
    props: gcp.pubsub.SubscriptionArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(pubsubSubscriptionProvider, name, props, opts);
  }
}
