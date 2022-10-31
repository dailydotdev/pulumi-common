import * as gcp from '@pulumi/gcp';
import { Output } from '@pulumi/pulumi';

export function serviceAccountToMember(
  serviceAccount:
    | gcp.serviceaccount.Account
    | Output<gcp.serviceaccount.Account>,
): Output<string> {
  return serviceAccount.email.apply((email) => `serviceAccount:${email}`);
}

export type IAMRole = { name: string; role: string };

export function addIAMRolesToServiceAccount(
  prefix: string,
  roles: IAMRole[],
  serviceAccount: gcp.serviceaccount.Account,
): gcp.projects.IAMMember[] {
  const member = serviceAccountToMember(serviceAccount);
  return roles.map(
    (role) =>
      new gcp.projects.IAMMember(`${prefix}-iam-${role.name}`, {
        project: gcp.config.project || '',
        role: role.role,
        member,
      }),
  );
}

export function createServiceAccountAndGrantRoles(
  resourceName: string,
  baseName: string,
  serviceAccountId: string,
  roles: IAMRole[],
  isAdhocEnv?: boolean,
): {
  serviceAccount?: gcp.serviceaccount.Account;
  iamMembers: gcp.projects.IAMMember[];
} {
  if (isAdhocEnv) {
    return { serviceAccount: undefined, iamMembers: [] };
  }

  const serviceAccount = new gcp.serviceaccount.Account(resourceName, {
    accountId: serviceAccountId,
    displayName: serviceAccountId,
  });

  const iamMembers = addIAMRolesToServiceAccount(
    baseName,
    roles,
    serviceAccount,
  );

  return { serviceAccount, iamMembers };
}
