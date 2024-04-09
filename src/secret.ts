import { Output } from '@pulumi/pulumi';
import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { camelToUnderscore } from './utils';
import { config } from './config';

export type Secret = { name: string; value: string | Output<string> };

export function createEncryptedEnvVar(
  prefix: string,
  key: string,
  value: string | Output<string>,
): Secret {
  const secret = new gcp.secretmanager.Secret(`${prefix}-secret-${key}`, {
    secretId: `${prefix}-secret-${key}`,
    replication: { auto: {} },
  });

  const version = new gcp.secretmanager.SecretVersion(`${prefix}-sv-${key}`, {
    enabled: true,
    secret: secret.name,
    secretData: value,
  });
  return {
    name: camelToUnderscore(key),
    value: pulumi
      .all([secret.secretId, version.id])
      .apply(
        ([name, version]) =>
          `gcp:///${name}/${version.split('/').reverse()[0]}`,
      ),
  };
}

export function createEnvVarsFromSecret(
  prefix: string,
): pulumi.Input<Secret>[] {
  const envVars = config.requireObject<Record<string, string>>('env');
  return Object.keys(envVars).map(
    (key): pulumi.Input<Secret> =>
      createEncryptedEnvVar(prefix, key, envVars[key]),
  );
}
