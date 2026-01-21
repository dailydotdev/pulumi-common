import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import { type Output } from '@pulumi/pulumi';

import { urnPrefix } from '../constants';
import {
  getLocalSqlConfig,
  type LocalSqlConfig,
  LocalSqlDatabase,
} from '../providers/localSql';

export type SqlInstanceArgs = gcp.sql.DatabaseInstanceArgs & {
  isAdhocEnv: boolean;
};

export class SqlInstance extends pulumi.ComponentResource {
  private readonly instance: gcp.sql.DatabaseInstance | undefined;
  private readonly databaseType: string;

  constructor(
    name: string,
    args: SqlInstanceArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:SqlInstance`, name, undefined, opts);

    if (!args.isAdhocEnv) {
      this.instance = new gcp.sql.DatabaseInstance(name, args, {
        ...opts,
        parent: this,
        aliases: [{ name, parent: pulumi.rootStackResource }],
      });
    }
    this.databaseType = (args.databaseVersion as string)
      .toLowerCase()
      .split('_')[0];
  }

  get name(): pulumi.Output<string> {
    return this.instance?.name || pulumi.output(this.databaseType);
  }

  get privateIpAddress(): pulumi.Output<string> {
    return this.instance?.privateIpAddress || pulumi.output(this.databaseType);
  }
}

export type SqlDatabaseArgs = gcp.sql.DatabaseArgs & {
  isAdhocEnv: boolean;
};

export class SqlDatabase extends pulumi.ComponentResource {
  private readonly databaseName: pulumi.Input<string>;

  constructor(
    name: string,
    args: SqlDatabaseArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:SqlDatabase`, name, undefined, opts);

    this.databaseName = args.name as pulumi.Input<string>;
    if (args.isAdhocEnv) {
      new LocalSqlDatabase(name, args, {
        ...opts,
        parent: this,
      });
    } else {
      new gcp.sql.Database(name, args, {
        ...opts,
        parent: this,
        aliases: [{ name, parent: pulumi.rootStackResource }],
      });
    }
  }

  get name(): pulumi.Output<string> {
    return pulumi.interpolate`${this.databaseName}`;
  }
}

export type SqlUserArgs = gcp.sql.UserArgs & {
  isAdhocEnv: boolean;
};

export class SqlUser extends pulumi.ComponentResource {
  private readonly instance: gcp.sql.User | undefined;
  private readonly instanceName: pulumi.Input<string>;

  constructor(
    name: string,
    args: SqlUserArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(`${urnPrefix}:SqlUser`, name, undefined, opts);

    if (!args.isAdhocEnv) {
      this.instance = new gcp.sql.User(name, args, {
        ...opts,
        parent: this,
        aliases: [{ name, parent: pulumi.rootStackResource }],
      });
    }
    this.instanceName = args.instance;
  }

  get name(): pulumi.Output<string> {
    return this.instance?.name || this.getConfig('user');
  }

  get password(): pulumi.Output<string | undefined> {
    return this.instance?.password || this.getConfig('password');
  }

  private getConfig(key: keyof LocalSqlConfig): Output<string> {
    return pulumi
      .all([this.instanceName])
      .apply(([instanceName]) => getLocalSqlConfig(instanceName))
      .apply((config) => config[key]);
  }
}
