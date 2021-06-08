import { Input, Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { cloudrun } from '@pulumi/gcp/types/input';
import ServiceTemplateSpecContainerEnv = cloudrun.ServiceTemplateSpecContainerEnv;
import { Resource } from '@pulumi/pulumi/resource';
export declare function getCloudRunPubSubInvoker(): Output<gcp.serviceaccount.Account>;
export declare enum CloudRunAccess {
    Public = 1,
    PubSub = 2
}
export declare function createCloudRunService(name: string, image: string, envs: Input<Input<ServiceTemplateSpecContainerEnv>[]>, limits: Input<{
    [key: string]: Input<string>;
}>, vpcConnector: gcp.vpcaccess.Connector | Output<gcp.vpcaccess.Connector>, serviceAccount: gcp.serviceaccount.Account | Output<gcp.serviceaccount.Account>, opts?: {
    minScale?: number;
    concurrency?: number;
    dependsOn?: Input<Input<Resource>[]>;
    access?: CloudRunAccess;
    iamMemberName?: string;
}): gcp.cloudrun.Service;
