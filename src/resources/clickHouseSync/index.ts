import * as k8s from '@pulumi/kubernetes';
import {
  ComponentResource,
  type CustomResourceOptions,
  type Input,
} from '@pulumi/pulumi';
import { createHash } from 'crypto';
import { stringify } from 'yaml';

import { urnPrefix } from '../../constants';
import { getSpotSettings } from '../../k8s';
import {
  commonLabels,
  configureResources,
  type EnvVariable,
  type Image,
  image,
  type Resources,
} from '../../kubernetes';
import { type AdhocEnv } from '../../utils';
import { type ClickHouseSyncConfig, loadConfig } from './utils';

export type ClickHouseSyncArgs = Partial<AdhocEnv> & {
  props: {
    path: string;
    keys: ClickHouseSyncConfig;
    vars?: Record<string, Input<string>>;
  };
  deployment?: {
    name?: Input<string>;
  };
  namespace: Input<string>;
  image?: Image;
  resources?: Resources;
  env?: Input<EnvVariable[]>;
  toleratesSpot?: boolean;
};

const defaults: {
  image: Image;
} = {
  image: {
    repository: 'altinity/clickhouse-sink-connector',
    digest:
      'sha256:1c0db9877331a0aaceb2e0f2838db3a5156a3cfbfdb83a92235b6287b576c5d0',
  },
};

export class ClickHouseSync extends ComponentResource {
  private config: k8s.core.v1.Secret;

  constructor(
    name: string,
    args: ClickHouseSyncArgs,
    resourceOptions?: CustomResourceOptions,
  ) {
    super(`${urnPrefix}:ClickHouseSync`, name, args, resourceOptions);

    const isAdhocEnv = args.isAdhocEnv || false;

    const deploymentName = args.deployment?.name || `${name}-clickhouse-sync`;

    const config = loadConfig(args.props.path, args.props.vars).apply(
      (config) => {
        return Buffer.from(
          stringify({ ...config, ...args.props.keys }),
        ).toString('base64');
      },
    );

    const configChecksum = config.apply((configString) =>
      createHash('sha256').update(configString).digest('hex'),
    );

    const { tolerations } = getSpotSettings(
      { enabled: args?.toleratesSpot ?? true },
      false,
    );

    this.config = new k8s.core.v1.Secret(
      `${name}-clickhouse-sync-config`,
      {
        metadata: {
          namespace: args.namespace,
          name: `${name}-clickhouse-sync-config`,
          labels: {
            ...commonLabels,
            'app.kubernetes.io/name': `${name}-clickhouse-sync-config`,
          },
        },
        data: {
          'config.yml': config,
        },
      },
      resourceOptions,
    );

    new k8s.apps.v1.Deployment(
      `${name}-clickhouse-sync`,
      {
        metadata: {
          namespace: args.namespace,
          name: deploymentName,
          labels: {
            ...commonLabels,
            'app.kubernetes.io/name': deploymentName,
          },
          annotations: {
            'chekcsum/secret': configChecksum,
          },
        },
        spec: {
          replicas: 1,
          strategy: {
            type: 'Recreate',
          },
          selector: {
            matchLabels: {
              'app.kubernetes.io/name': deploymentName,
            },
          },
          template: {
            metadata: {
              labels: {
                'app.kubernetes.io/name': deploymentName,
              },
            },
            spec: {
              containers: [
                {
                  name: 'clickhouse-sink-connector',
                  image: image(args.image || defaults.image),
                  // Need to change the command from upstream, as we can't mount the config file directly to root directory
                  command: [
                    'java',
                    '-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005',
                    '-jar',
                    '/app.jar',
                    '/config/config.yml',
                    'com.altinity.clickhouse.debezium.embedded.ClickHouseDebeziumEmbeddedApplication',
                  ],
                  ports: [
                    {
                      name: 'healthcheck',
                      containerPort: 8080,
                    },
                  ],
                  env: args.env,
                  resources: configureResources({
                    isAdhocEnv: isAdhocEnv,
                    resources: args.resources,
                  }),
                  volumeMounts: [
                    {
                      name: 'clickhouse-config',
                      mountPath: '/config',
                    },
                  ],
                },
              ],
              volumes: [
                {
                  name: 'clickhouse-config',
                  secret: {
                    secretName: this.config.metadata.name,
                  },
                },
              ],
              tolerations: tolerations,
            },
          },
        },
      },
      resourceOptions,
    );
  }
}

export * from './utils';
