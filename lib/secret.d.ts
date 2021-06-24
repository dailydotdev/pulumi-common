import { Output } from '@pulumi/pulumi';
import * as pulumi from '@pulumi/pulumi';
export declare type Secret = {
    name: string;
    value: string | Output<string>;
};
export declare function createEncryptedEnvVar(prefix: string, key: string, value: string | Output<string>): Secret;
export declare function createEnvVarsFromSecret(prefix: string): pulumi.Input<Secret>[];
