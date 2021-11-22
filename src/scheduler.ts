import { Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { getCloudRunPubSubInvoker } from './cloudRun';

type Cron = {
  name: string;
  schedule: string;
  body?: string;
};

export type CronPubSub = Cron & { topic: string };
export type CronHttp = Cron & {
  endpoint?: string;
  headers?: Record<string, string>;
};

export function createCronJobs(
  name: string,
  crons: CronHttp[],
  serviceUrl: Output<string>,
): gcp.cloudscheduler.Job[] {
  const cloudRunPubSubInvoker = getCloudRunPubSubInvoker();
  return crons.map((cron) => {
    const uri = serviceUrl.apply(
      (url) => `${url}/${cron.endpoint ?? cron.name}`,
    );
    return new gcp.cloudscheduler.Job(`${name}-job-${cron.name}`, {
      name: `${name}-${cron.name}`,
      schedule: cron.schedule,
      httpTarget: {
        uri,
        httpMethod: 'POST',
        oidcToken: {
          serviceAccountEmail: cloudRunPubSubInvoker.email,
          audience: uri,
        },
        headers: cron.headers,
        body: cron.body
          ? Buffer.from(cron.body, 'utf8').toString('base64')
          : undefined,
      },
    });
  });
}

const mapUnique = <Source, Target>(
  array: Source[],
  callback: (value: Source) => Target,
): Target[] => Array.from(new Set(array)).map(callback);

export function createPubSubCronJobs(
  name: string,
  crons: CronPubSub[],
): gcp.cloudscheduler.Job[] {
  const { project } = gcp.config;
  const topics = mapUnique(
    crons.map((cron) => cron.topic),
    (topic) =>
      new gcp.pubsub.Topic(`${name}-cron-topic-${topic}`, {
        name: topic,
      }),
  );
  return crons.map(
    (cron) =>
      new gcp.cloudscheduler.Job(
        `${name}-job-${cron.name}`,
        {
          name: `${name}-${cron.name}`,
          schedule: cron.schedule,
          pubsubTarget: {
            data: Buffer.from(cron.body ?? '{}', 'utf8').toString('base64'),
            topicName: `projects/${project}/topics/${cron.topic}`,
          },
        },
        { dependsOn: topics },
      ),
  );
}
