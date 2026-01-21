import { all, type Input } from '@pulumi/pulumi';
import { readFile } from 'fs/promises';
import { parse } from 'yaml';

export type ClickHouseSyncConfig = Partial<{
  name: Input<string>;
  'slot.name': Input<string>;
  'database.hostname': Input<string>;
  'database.port': Input<string>;
  'database.user': Input<string>;
  'database.password': Input<string>;
  'database.server.name': Input<string>;
  'schema.include.list': Input<string>;
  'plugin.name': Input<string>;
  'table.include.list': Input<string>;
  'clickhouse.server.url': Input<string>;
  'clickhouse.server.user': Input<string>;
  'clickhouse.server.password': Input<string>;
  'clickhouse.server.port': Input<string>;
  'clickhouse.server.database': Input<string>;
  'database.allowPublicKeyRetrieval': Input<string>;
  'snapshot.mode': Input<string>;
  'offset.flush.interval.ms': Input<number>;
  'connector.class': Input<string>;
  'offset.storage': Input<string>;
  'offset.storage.jdbc.offset.table.name': Input<string>;
  'offset.storage.jdbc.url': Input<string>;
  'offset.storage.jdbc.user': Input<string>;
  'offset.storage.jdbc.password': Input<string>;
  'offset.storage.jdbc.offset.table.ddl': Input<string>;
  'offset.storage.jdbc.offset.table.delete': Input<string>;
  'schema.history.internal': Input<string>;
  'schema.history.internal.jdbc.url': Input<string>;
  'schema.history.internal.jdbc.user': Input<string>;
  'schema.history.internal.jdbc.password': Input<string>;
  'schema.history.internal.jdbc.schema.history.table.ddl': Input<string>;
  'schema.history.internal.jdbc.schema.history.table.name': Input<string>;
  'enable.snapshot.ddl': Input<string>;
  'auto.create.tables': Input<string>;
  'database.dbname': Input<string>;
  'clickhouse.datetime.timezone': Input<string>;
  skip_replica_start: Input<string>;
  'binary.handling.mode': Input<string>;
  ignore_delete: Input<string>;
  'disable.ddl': Input<string>;
  'disable.drop.truncate': Input<string>;
  [key: string]: Input<string | number>;
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
