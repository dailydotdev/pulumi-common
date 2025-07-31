import {
  ComponentResource,
  output,
  type CustomResourceOptions,
  type Input,
} from '@pulumi/pulumi';
import { urnPrefix } from '../../constants';
import { helm } from '@pulumi/kubernetes';
import { charts, type PriorityClassInput } from '../../kubernetes';
import type { AdhocEnv } from '../../utils';

export type K8sNATSArgs = Partial<AdhocEnv & PriorityClassInput> & {
  namespace: string;
  storageSizeGb?: Input<number>;
};

export class KubernetesNATS extends ComponentResource {
  public chart: helm.v4.Chart;

  constructor(
    name: string,
    args: K8sNATSArgs,
    resourceOptions?: CustomResourceOptions,
  ) {
    super(`${urnPrefix}:KubernetesNATS`, name, {}, resourceOptions);

    this.chart = new helm.v4.Chart(
      name,
      {
        ...charts['nats'],
        namespace: args.namespace,
        values: {
          fullnameOverride: name,
          config: {
            jetstream: {
              enabled: true,
              fileStore: {
                pvc: {
                  size: output(args.storageSizeGb).apply(
                    (size) => `${Math.max(size ?? 0, 4)}Gi`,
                  ),
                },
              },
            },
          },
          promExporter: {
            enabled: true,
          },
          natsBox: {
            enabled: false,
          },
        },
      },
      resourceOptions,
    );
  }
}
