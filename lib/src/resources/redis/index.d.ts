import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { AdhocEnv } from '../../utils';
export type RedisArgs = AdhocEnv & gcp.redis.InstanceArgs;
export declare class Redis extends pulumi.ComponentResource {
    private instance;
    constructor(name: string, args: RedisArgs, opts?: pulumi.CustomResourceOptions);
    get host(): pulumi.Output<string>;
    get port(): pulumi.Output<number>;
    get authString(): pulumi.Output<string>;
}
export * from './kubernetesRedis';
export * from './kubernetesRedisCluster';
