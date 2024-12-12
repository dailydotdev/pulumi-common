import { getIAMPolicy } from '@pulumi/gcp/organizations/getIAMPolicy';
import { Bucket, BucketIAMPolicy } from '@pulumi/gcp/storage';
import type { ServiceAccount } from '@pulumi/kubernetes/core/v1';

import { k8sServiceAccountToWorkloadPrincipal } from '../../k8s';
import type { AdhocEnv } from '../../utils';

export const createGcsBucket = ({
  name,
  serviceAccount,
  resourcePrefix,
  readOnly = false,
  isAdhocEnv,
}: {
  name: string;
  serviceAccount?: ServiceAccount;
  resourcePrefix?: string;
  readOnly?: boolean;
} & Partial<AdhocEnv>): Partial<{
  bucket: Bucket;
  bucketIAMPolicy: BucketIAMPolicy;
}> => {
  if (isAdhocEnv) {
    return {};
  }

  const bucket = new Bucket(`${resourcePrefix}${name}-debezium-storage`, {
    name: `${name}-debezium-storage`,
    location: 'us',
    publicAccessPrevention: 'enforced',
    uniformBucketLevelAccess: true,
  });

  let bucketIAMPolicy: BucketIAMPolicy | undefined = undefined;

  if (serviceAccount) {
    const objectUsers = getIAMPolicy({
      bindings: [
        {
          role: readOnly
            ? 'roles/storage.objectViewer'
            : 'roles/storage.objectUser',
          members: [
            k8sServiceAccountToWorkloadPrincipal(
              serviceAccount,
            ) as unknown as string,
          ],
        },
      ],
    });

    bucketIAMPolicy = new BucketIAMPolicy(
      `${resourcePrefix}${name}-debezium-storage-policy`,
      {
        bucket: bucket.name,
        policyData: objectUsers.then((objectUser) => objectUser.policyData),
      },
    );
  }

  return {
    bucket,
    bucketIAMPolicy,
  };
};
