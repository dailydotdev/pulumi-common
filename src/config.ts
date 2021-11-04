import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';

export const config = new pulumi.Config();
export const stack = pulumi.getStack();
export const location = gcp.config.region || 'us-central1';
export const getImageTag = (): string => config.require('tag');

export const infra = new pulumi.StackReference(`idoshamun/infra/${stack}`);
