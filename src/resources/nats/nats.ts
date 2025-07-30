import { ComponentResource, type CustomResourceOptions } from '@pulumi/pulumi';
import { urnPrefix } from '../../constants';
import { helm } from '@pulumi/kubernetes';
import { charts, type PriorityClassInput } from '../../kubernetes';
import type { AdhocEnv } from '../../utils';

export type K8sNATSArgs = Partial<AdhocEnv & PriorityClassInput> & {
  namespace: string;
};

export class KubernetesNATS extends ComponentResource {
  public chart: helm.v4.Chart;

  constructor(name: string, args: K8sNATSArgs, opts?: CustomResourceOptions) {
    super(`${urnPrefix}:KubernetesNATS`, name, {}, opts);

    this.chart = new helm.v4.Chart(name, {
      ...charts['nats'],
      namespace: args.namespace,
      values: {
        fullnameOverride: name,
        config: {
          jetstream: {
            enabled: true,
          },
        },
        promExporter: {
          enabled: true,
        },
        natsBox: {
          enabled: false,
        },
      },
    });
  }
}
