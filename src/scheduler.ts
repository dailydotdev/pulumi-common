import { Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { getCloudRunPubSubInvoker } from './cloudRun';

export type Cron = {
  name: string;
  endpoint?: string;
  schedule: string;
  headers?: Record<string, string>;
  body?: string;
};

export function createCronJobs(
  name: string,
  crons: Cron[],
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
