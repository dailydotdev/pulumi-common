import { ComponentResource, type Input } from '@pulumi/pulumi';
import { urnPrefix } from '../../constants';
import { apps, core, rbac } from '@pulumi/kubernetes';

import { isNullOrUndefined, type AdhocEnv } from '../../utils';
import { image, type Image, type Resources } from '../..';

export type K8sRedisSentinelMonitorArgs = Partial<AdhocEnv> & {
  namespace: Input<string>;
  image?: Partial<Image>;
  resources?: Resources;

  sentinel: {
    name: Input<string>;
    namespace: Input<string>;
    authKey: Input<string>;
  };
};

const defaults: {
  image: Image;
} = {
  image: {
    repository: 'daily-ops/redis-sentinel-monitor',
    registry: 'gcr.io',
    tag: 'latest',
  },
};

export class KubernetesSentinelMonitor extends ComponentResource {
  constructor(name: string, args: K8sRedisSentinelMonitorArgs) {
    super(`${urnPrefix}:KubernetesSentinelMonitor`, name, {}, undefined);

    const podLabels = {
      'app.kubernetes.io/name': 'redis-sentinel-monitor',
      'app.kubernetes.io/instance': name,
      'app.kubernetes.io/component': 'monitor',
      'app.kubernetes.io/version': 'latest',
      'app.kubernetes.io/managed-by': 'pulumi',
    };

    const serviceAccount = new core.v1.ServiceAccount(name, {
      metadata: {
        name: name,
        namespace: args.namespace,
      },
    });

    const role = new rbac.v1.Role(
      name,
      {
        metadata: {
          name: name,
          namespace: args.namespace,
        },
        rules: [
          {
            apiGroups: [''],
            resources: ['pods'],
            verbs: ['get', 'list', 'watch', 'patch'],
          },
        ],
      },
      {
        dependsOn: [serviceAccount],
      },
    );

    const roleBinding = new rbac.v1.RoleBinding(
      name,
      {
        metadata: {
          name: name,
          namespace: args.namespace,
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            name: serviceAccount.metadata.name,
            namespace: args.namespace,
          },
        ],
        roleRef: {
          kind: 'Role',
          name: role.metadata.name,
          apiGroup: 'rbac.authorization.k8s.io',
        },
      },
      {
        dependsOn: [role],
      },
    );

    const secret = new core.v1.Secret(name, {
      metadata: {
        name: `${name}`,
        namespace: args.namespace,
      },
      stringData: {
        REDIS_SENTINEL_SERVICE_NAME: `${args.sentinel.name}-headless`,
        REDIS_SENTINEL_PASSWORD: args.sentinel.authKey,
        NAMESPACE: args.sentinel.namespace,
      },
    });

    const deployment = new apps.v1.Deployment(
      name,
      {
        metadata: {
          name: name,
          namespace: args.namespace,
          labels: podLabels,
        },
        spec: {
          selector: {
            matchLabels: podLabels,
          },
          template: {
            metadata: {
              labels: podLabels,
            },

            spec: {
              serviceAccountName: serviceAccount.metadata.name,
              containers: [
                {
                  name: 'redis-sentinel-monitor',
                  image: image({
                    ...defaults.image,
                    ...args.image,
                  } as Image),
                  resources: isNullOrUndefined(args.resources)
                    ? undefined
                    : {
                        requests: {
                          cpu:
                            args.resources.requests?.cpu?.toString() ?? '50m',
                          memory: args.resources.requests?.memory ?? '32Mi',
                        },
                        limits: {
                          memory: args.resources.limits?.memory ?? '128Mi',
                        },
                      },
                  env: [
                    {
                      name: 'ENVIRONMENT',
                      value: args.isAdhocEnv ? 'development' : 'production',
                    },
                  ],
                  envFrom: [
                    {
                      secretRef: {
                        name: secret.metadata.name,
                      },
                    },
                  ],
                  readinessProbe: {
                    httpGet: {
                      path: '/healthz',
                      port: 8080,
                    },
                    initialDelaySeconds: 5,
                    timeoutSeconds: 5,
                  },
                  livenessProbe: {
                    httpGet: {
                      path: '/healthz',
                      port: 8080,
                    },
                    initialDelaySeconds: 5,
                    timeoutSeconds: 5,
                  },
                },
              ],
            },
          },
        },
      },
      { dependsOn: [serviceAccount, secret, roleBinding] },
    );

    new core.v1.Service(
      `${name}-redis-master`,
      {
        metadata: {
          name: `${args.sentinel.name}-master`,
          namespace: args.namespace,
        },
        spec: {
          type: 'ClusterIP',
          selector: {
            'app.kubernetes.io/instance': args.sentinel.name,
            'app.kubernetes.io/component': 'node',
            'app.kubernetes.io/name': 'redis',
            'app.kubernetes.io/role': 'master',
          },
          ports: [
            {
              name: 'redis',
              port: 6379,
              targetPort: 6379,
            },
          ],
        },
      },
      {
        dependsOn: [deployment],
      },
    );
  }
}
