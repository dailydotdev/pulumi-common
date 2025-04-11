"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceAccountToMember = serviceAccountToMember;
exports.addIAMRolesToServiceAccount = addIAMRolesToServiceAccount;
exports.createServiceAccountAndGrantRoles = createServiceAccountAndGrantRoles;
const gcp = require("@pulumi/gcp");
function serviceAccountToMember(serviceAccount) {
    return serviceAccount.email.apply((email) => `serviceAccount:${email}`);
}
function addIAMRolesToServiceAccount(prefix, roles, serviceAccount) {
    const member = serviceAccountToMember(serviceAccount);
    return roles.map((role) => new gcp.projects.IAMMember(`${prefix}-iam-${role.name}`, {
        project: gcp.config.project || '',
        role: role.role,
        member,
    }));
}
function createServiceAccountAndGrantRoles(resourceName, baseName, serviceAccountId, roles, isAdhocEnv) {
    if (isAdhocEnv) {
        return { serviceAccount: undefined, iamMembers: [] };
    }
    const serviceAccount = new gcp.serviceaccount.Account(resourceName, {
        accountId: serviceAccountId,
        displayName: serviceAccountId,
    });
    const iamMembers = addIAMRolesToServiceAccount(baseName, roles, serviceAccount);
    return { serviceAccount, iamMembers };
}
