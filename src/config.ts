import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';

export const config = new pulumi.Config();
export const location = gcp.config.region || 'us-central1';
export const getImageTag = (): string => config.require('tag');

export const getInfra = (stack = pulumi.getStack()): pulumi.StackReference =>
  new pulumi.StackReference(`dailydotdev/infra/${stack}`);

export const detectIsAdhocEnv = (): boolean => pulumi.getStack() === 'adhoc';

export const getImageAndTag = (
  image: string,
): { image: string; imageTag: string } => {
  const userImage = config.get<string>('image');
  if (userImage) {
    return { image: userImage, imageTag: userImage.split(':')[1] };
  }
  const imageTag = getImageTag();
  return { image: `${image}:${imageTag}`, imageTag };
};
