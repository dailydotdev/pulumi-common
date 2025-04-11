import * as pulumi from '@pulumi/pulumi';
import { CommonK8sRedisArgs } from './common';
export type K8sRedisClusterArgs = CommonK8sRedisArgs & {
    nodes: pulumi.Input<number>;
    password?: pulumi.Input<string>;
};
export declare class KubernetesRedisCluster extends pulumi.ComponentResource {
    constructor(name: string, args: K8sRedisClusterArgs, resourceOptions?: pulumi.CustomResourceOptions);
}
