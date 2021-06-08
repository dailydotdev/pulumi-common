import { Output } from '@pulumi/pulumi';
import * as pulumi from '@pulumi/pulumi';
export declare type Secret = {
    name: string;
    value: string | Output<string>;
};
export declare function createEnvVarsFromSecret(prefix: string): pulumi.Input<Secret>[];
