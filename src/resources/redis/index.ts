import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { urnPrefix } from '../../constants';
import { AdhocEnv } from '../../utils';

export type RedisArgs = AdhocEnv & gcp.redis.InstanceArgs;

const REDIS_LOCAL_HOST = 'redis';
const REDIS_LOCAL_PORT = 6379;
const REDIS_LOCAL_AUTH = '';

export class Redis extends pulumi.ComponentResource {
  private instance: gcp.redis.Instance | undefined;

  constructor(
    name: string,
    args: RedisArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:Redis`, name, args, opts);

    if (!args.isAdhocEnv) {
      this.instance = new gcp.redis.Instance(name, args, {
        ...opts,
        parent: this,
        aliases: [{ name, parent: pulumi.rootStackResource }],
      });
    }
  }

  get host(): pulumi.Output<string> {
    return this.instance?.host || pulumi.output(REDIS_LOCAL_HOST);
  }

  get port(): pulumi.Output<number> {
    return this.instance?.port || pulumi.output(REDIS_LOCAL_PORT);
  }

  get authString(): pulumi.Output<string> {
    return this.instance?.authString || pulumi.output(REDIS_LOCAL_AUTH);
  }
}

export * from './kubernetesRedis';
export * from './kubernetesRedisCluster';
