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

export function createSubscriptionsFromWorkers(
  name: string,
  isAdhocEnv: boolean,
  workers: Worker[],
  {
    serviceUrl,
    dependsOn,
    serviceAccount,
  }: {
    serviceUrl?: Output<string>;
    dependsOn?: Input<Input<Resource>[]> | Input<Resource>;
    serviceAccount?: Output<gcp.serviceaccount.Account>;
  } = {},
): StreamSubscription[] {
  if (!serviceAccount && serviceUrl) {
    throw new Error('service account must be provided');
  }
  return workers.map(
    (worker) =>
      new StreamSubscription(
        `${name}-sub-${worker.subscription}`,
        {
          isAdhocEnv,
          topic: worker.topic,
          name: worker.subscription,
          pushConfig: serviceUrl
            ? {
                pushEndpoint: serviceUrl.apply(
                  (url) => `${url}/${worker.endpoint ?? worker.subscription}`,
                ),
                oidcToken: {
                  serviceAccountEmail: serviceAccount?.email ?? '',
                },
              }
            : undefined,
          retryPolicy: {
            minimumBackoff: '1s',
            maximumBackoff: '60s',
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
