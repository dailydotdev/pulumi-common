import { ComponentResource, CustomResourceOptions, Input } from '@pulumi/pulumi';
import { AdhocEnv } from '../../utils';
import { EnvVariable, Image, Resources } from '../../kubernetes';
import { ClickHouseSyncConfig } from './utils';
export type ClickHouseSyncArgs = Partial<AdhocEnv> & {
    props: {
        path: string;
        keys: ClickHouseSyncConfig;
        vars?: Record<string, Input<string>>;
    };
    deployment?: {
        name?: Input<string>;
    };
    namespace: Input<string>;
    image?: Image;
    resources?: Resources;
    env?: Input<EnvVariable[]>;
    toleratesSpot?: boolean;
};
export declare class ClickHouseSync extends ComponentResource {
    private deployment;
    private config;
    constructor(name: string, args: ClickHouseSyncArgs, resourceOptions?: CustomResourceOptions);
}
export * from './utils';
