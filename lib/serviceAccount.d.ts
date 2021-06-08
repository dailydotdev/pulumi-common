import * as gcp from '@pulumi/gcp';
import { Output } from '@pulumi/pulumi';
export declare function serviceAccountToMember(serviceAccount: gcp.serviceaccount.Account | Output<gcp.serviceaccount.Account>): Output<string>;
export declare type IAMRole = {
    name: string;
    role: string;
};
export declare function addIAMRolesToServiceAccount(prefix: string, roles: IAMRole[], serviceAccount: gcp.serviceaccount.Account): gcp.projects.IAMMember[];
export declare function createServiceAccountAndGrantRoles(resourceName: string, baseName: string, serviceAccountId: string, roles: IAMRole[]): {
    serviceAccount: gcp.serviceaccount.Account;
    iamMembers: gcp.projects.IAMMember[];
};
