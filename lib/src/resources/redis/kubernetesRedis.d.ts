import * as pulumi from '@pulumi/pulumi';
import { CommonK8sRedisArgs } from './common';
export type K8sRedisArgs = CommonK8sRedisArgs & {
    architecture?: pulumi.Input<'standalone' | 'replication'>;
};
export declare class KubernetesRedis extends pulumi.ComponentResource {
    constructor(name: string, args: K8sRedisArgs, resourceOptions?: pulumi.CustomResourceOptions);
}
