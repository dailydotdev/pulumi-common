import * as k8s from '@pulumi/kubernetes';
import { Input, Output } from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { core } from '@pulumi/kubernetes/types/input';
import EnvVar = core.v1.EnvVar;
export declare function k8sServiceAccountToIdentity(serviceAccount: k8s.core.v1.ServiceAccount): Output<string>;
export declare function createK8sServiceAccountFromGCPServiceAccount(resourceName: string, name: string, namespace: string, serviceAccount: gcp.serviceaccount.Account): k8s.core.v1.ServiceAccount;
export declare function createMigrationJob(name: string, namespace: string, image: string, args: string[], env: Input<Input<EnvVar>[]>, serviceAccount: k8s.core.v1.ServiceAccount): k8s.batch.v1.Job;
