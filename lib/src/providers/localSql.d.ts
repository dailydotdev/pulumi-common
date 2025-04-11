import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
export type LocalSqlConfig = {
    user: string;
    password: string;
    database: string;
};
export declare function getLocalSqlConfig(databaseType: string): LocalSqlConfig;
export declare class LocalSqlDatabase extends pulumi.dynamic.Resource {
    constructor(name: string, props: gcp.sql.DatabaseArgs, opts?: pulumi.CustomResourceOptions);
}
