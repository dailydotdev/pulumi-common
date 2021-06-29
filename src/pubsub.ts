import { Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { getCloudRunPubSubInvoker } from './cloudRun';
import { SubscriptionArgs } from '@pulumi/gcp/pubsub/subscription';

export type Worker = {
  topic: string;
  subscription: string;
  endpoint?: string;
  args?: Partial<SubscriptionArgs>;
};

export function createSubscriptionsFromWorkers(
  name: string,
  workers: Worker[],
  serviceUrl: Output<string>,
): gcp.pubsub.Subscription[] {
  const cloudRunPubSubInvoker = getCloudRunPubSubInvoker();
  return workers.map(
    (worker) =>
      new gcp.pubsub.Subscription(`${name}-sub-${worker.subscription}`, {
        topic: worker.topic,
        name: worker.subscription,
        pushConfig: {
          pushEndpoint: serviceUrl.apply(
            (url) => `${url}/${worker.endpoint ?? worker.subscription}`,
          ),
          oidcToken: {
            serviceAccountEmail: cloudRunPubSubInvoker.email,
          },
        },
        retryPolicy: {
          minimumBackoff: '10s',
          maximumBackoff: '600s',
        },
        ...worker.args,
      }),
  );
}
