import { Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { getCloudRunPubSubInvoker } from './cloudRun';
import { SubscriptionArgs } from '@pulumi/gcp/pubsub/subscription';
import { Input } from '@pulumi/pulumi/output';
import { Resource } from '@pulumi/pulumi/resource';

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
  dependsOn?: Input<Input<Resource>[]> | Input<Resource>,
): gcp.pubsub.Subscription[] {
  const cloudRunPubSubInvoker = getCloudRunPubSubInvoker();
  return workers.map(
    (worker) =>
      new gcp.pubsub.Subscription(
        `${name}-sub-${worker.subscription}`,
        {
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
        },
        {
          dependsOn,
        },
      ),
  );
}

export function addLabelsToWorkers(
  workers: Worker[],
  labels: Input<{
    [key: string]: Input<string>;
  }>,
): Worker[] {
  return workers.map((worker: Worker) => ({
    ...worker,
    args: {
      ...worker.args,
      labels,
    },
  }));
}
