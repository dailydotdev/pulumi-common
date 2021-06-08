"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceAccountAndGrantRoles = exports.addIAMRolesToServiceAccount = exports.serviceAccountToMember = void 0;
const gcp = require("@pulumi/gcp");
function serviceAccountToMember(serviceAccount) {
    return serviceAccount.email.apply((email) => `serviceAccount:${email}`);
}
exports.serviceAccountToMember = serviceAccountToMember;
function addIAMRolesToServiceAccount(prefix, roles, serviceAccount) {
    const member = serviceAccountToMember(serviceAccount);
    return roles.map((role) => new gcp.projects.IAMMember(`${prefix}-iam-${role.name}`, {
        role: role.role,
        member,
    }));
}
exports.addIAMRolesToServiceAccount = addIAMRolesToServiceAccount;
function createServiceAccountAndGrantRoles(resourceName, baseName, serviceAccountId, roles) {
    const serviceAccount = new gcp.serviceaccount.Account(resourceName, {
        accountId: serviceAccountId,
        displayName: serviceAccountId,
    });
    const iamMembers = addIAMRolesToServiceAccount(baseName, roles, serviceAccount);
    return { serviceAccount, iamMembers };
}
exports.createServiceAccountAndGrantRoles = createServiceAccountAndGrantRoles;
