import * as pulumi from '@pulumi/pulumi';
export declare const config: pulumi.Config;
export declare const location: string;
export declare const getImageTag: (tagConfigKey?: string) => string;
export declare const getInfra: (stack?: string) => pulumi.StackReference;
export declare const detectIsAdhocEnv: () => boolean;
export declare const getImageAndTag: (image: string, imageConfigKey?: string, tagConfigKey?: string) => {
    image: string;
    imageTag: string;
};
