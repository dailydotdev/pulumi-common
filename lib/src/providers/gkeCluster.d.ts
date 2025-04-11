import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';
import { Output } from '@pulumi/pulumi';
export declare class GkeCluster extends pulumi.ComponentResource {
    cluster: Output<gcp.container.Cluster> | gcp.container.Cluster;
    provider: k8s.Provider;
    constructor(name: string, cluster: Output<gcp.container.Cluster> | gcp.container.Cluster, opts?: pulumi.ComponentResourceOptions);
}
export declare function getLegacyCluster(stack?: string): GkeCluster;
export declare function getVpcNativeCluster(stack?: string): GkeCluster;
