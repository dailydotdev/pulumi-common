import { Input, all } from '@pulumi/pulumi';
import { readFile } from 'fs/promises';
import { parse } from 'yaml';

export type ClickHouseSyncConfig = Partial<{
  name: string;
  'slot.name': string;
  'database.hostname': string;
  'database.port': string;
  'database.user': string;
  'database.password': string;
  'database.server.name': string;
  'schema.include.list': string;
  'plugin.name': string;
  'table.include.list': string;
  'clickhouse.server.url': string;
  'clickhouse.server.user': string;
  'clickhouse.server.password': string;
  'clickhouse.server.port': string;
  'clickhouse.server.database': string;
  'database.allowPublicKeyRetrieval': string;
  'snapshot.mode': string;
  'offset.flush.interval.ms': number;
  'connector.class': string;
  'offset.storage': string;
  'offset.storage.jdbc.offset.table.name': string;
  'offset.storage.jdbc.url': string;
  'offset.storage.jdbc.user': string;
  'offset.storage.jdbc.password': string;
  'offset.storage.jdbc.offset.table.ddl': string;
  'offset.storage.jdbc.offset.table.delete': string;
  'schema.history.internal': string;
  'schema.history.internal.jdbc.url': string;
  'schema.history.internal.jdbc.user': string;
  'schema.history.internal.jdbc.password': string;
  'schema.history.internal.jdbc.schema.history.table.ddl': string;
  'schema.history.internal.jdbc.schema.history.table.name': string;
  'enable.snapshot.ddl': string;
  'auto.create.tables': string;
  'database.dbname': string;
  'clickhouse.datetime.timezone': string;
  skip_replica_start: string;
  'binary.handling.mode': string;
  ignore_delete: string;
  'disable.ddl': string;
  'disable.drop.truncate': string;
  [key: string]: string | number;
}>;

// Load the configuration from a file, replacing any variables in the file with the provided values.
export const loadConfig = (
  configPath: string,
  configVars?: Record<string, Input<string>>,
) =>
  all([configPath, configVars ?? {}]).apply(async ([path, vars]) =>
    parse(
      Object.keys(vars).reduce(
        // Use regex to replace all instances of the variable in the file.
        (acc, key) => acc.replace(RegExp(`%${key}%`, 'g'), vars[key]),
        await readFile(path, 'utf-8'),
      ),
    ),
  );
