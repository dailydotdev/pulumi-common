import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
export type SqlInstanceArgs = gcp.sql.DatabaseInstanceArgs & {
    isAdhocEnv: boolean;
};
export declare class SqlInstance extends pulumi.ComponentResource {
    private readonly instance;
    private readonly databaseType;
    constructor(name: string, args: SqlInstanceArgs, opts?: pulumi.CustomResourceOptions);
    get name(): pulumi.Output<string>;
    get privateIpAddress(): pulumi.Output<string>;
}
export type SqlDatabaseArgs = gcp.sql.DatabaseArgs & {
    isAdhocEnv: boolean;
};
export declare class SqlDatabase extends pulumi.ComponentResource {
    private readonly instance;
    private readonly databaseName;
    constructor(name: string, args: SqlDatabaseArgs, opts?: pulumi.CustomResourceOptions);
    get name(): pulumi.Output<string>;
}
export type SqlUserArgs = gcp.sql.UserArgs & {
    isAdhocEnv: boolean;
};
export declare class SqlUser extends pulumi.ComponentResource {
    private readonly instance;
    private readonly instanceName;
    constructor(name: string, args: SqlUserArgs, opts?: pulumi.CustomResourceOptions);
    get name(): pulumi.Output<string>;
    get password(): pulumi.Output<string | undefined>;
    private getConfig;
}
