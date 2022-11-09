import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { Knex } from 'knex';
import knex from 'knex';
import * as resource from '@pulumi/pulumi/resource';

export type LocalSqlConfig = {
  user: string;
  password: string;
  database: string;
};

export function getLocalSqlConfig(databaseType: string): LocalSqlConfig {
  switch (databaseType) {
    case 'postgres':
      return { user: 'postgres', password: '12345', database: 'postgres' };
    case 'mysql':
      return { user: 'root', password: 'root', database: 'gateway' };
    default:
      throw new Error('unsupported database type');
  }
}

const _clients: Record<string, Knex> = {};

function getClient(databaseType: string): Knex {
  if (!(databaseType in _clients)) {
    _clients[databaseType] = knex({
      client: databaseType,
      connection: {
        host: 'localhost',
        ...getLocalSqlConfig(databaseType),
      },
    });
  }
  return _clients[databaseType];
}

class LocalSqlDatabaseProvider implements pulumi.dynamic.ResourceProvider {
  async create({
    name: nameInput,
    instance: instanceInput,
  }: gcp.sql.DatabaseArgs): Promise<pulumi.dynamic.CreateResult> {
    const instance = (await instanceInput) as string;
    const name = (await nameInput) as string;
    const client = getClient(instance);
    switch (instance) {
      case 'postgres':
        const res = await client.raw<{ rowCount: number }>(
          `SELECT
           FROM pg_catalog.pg_database
           WHERE datname = '${name}'`,
        );
        if (!res.rowCount) {
          await client.raw(`CREATE DATABASE ${name}`);
        }
        break;
      case 'mysql':
        await client.raw(`CREATE DATABASE IF NOT EXISTS ${name}`);
        break;
    }
    return { id: `${name}_${instance}` };
  }

  async update(
    id: resource.ID,
    olds: gcp.sql.DatabaseArgs,
    news: gcp.sql.DatabaseArgs,
  ): Promise<pulumi.dynamic.UpdateResult> {
    await this.create(news);
    return {};
  }

  async diff(id: pulumi.ID): Promise<pulumi.dynamic.DiffResult> {
    const [name, databaseType] = id.split('_');
    const client = getClient(databaseType);
    switch (databaseType) {
      case 'postgres': {
        const res = await client.raw<{ rowCount: number }>(
          `SELECT
           FROM pg_catalog.pg_database
           WHERE datname = '${name}'`,
        );
        return { changes: !res.rowCount };
      }
      case 'mysql': {
        const res = await client.raw<unknown[]>(
          `SHOW DATABASES LIKE '${name}'`,
        );
        return { changes: !res.length };
      }
    }
    return { changes: false };
  }
}

const localSqlDatabaseProvider = new LocalSqlDatabaseProvider();

export class LocalSqlDatabase extends pulumi.dynamic.Resource {
  constructor(
    name: string,
    props: gcp.sql.DatabaseArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(localSqlDatabaseProvider, name, props, opts);
  }
}
