import { all, Config, type Input, type Output } from '@pulumi/pulumi';

import { type PodResources } from './k8s';

export interface AdhocEnv {
  isAdhocEnv: boolean;
}

export const isNullOrUndefined = (value: unknown) =>
  typeof value === 'undefined' || value === null;

export function camelToUnderscore(key: string): string {
  const result = key.replace(/([A-Z])/g, ' $1');
  return result.split(' ').join('_').toUpperCase();
}

export function nodeOptions(memory: number): { name: string; value: string } {
  return {
    name: 'NODE_OPTIONS',
    value: `--max-old-space-size=${Math.floor(memory * 0.9).toFixed(0)}`,
  };
}

// Do not limit cpu (https://home.robusta.dev/blog/stop-using-cpu-limits/)
export function stripCpuFromLimits(
  requests: Input<Partial<PodResources>>,
): Output<Omit<Partial<PodResources>, 'cpu'>> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return all([requests]).apply(([{ cpu, ...rest }]) => rest);
}

export const gcpProjectNumber = () => {
  const __config = new Config();
  return __config.require('projectNumber');
};

export type OctalDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7';
export type OctalPermission =
  | `${OctalDigit}${OctalDigit}${OctalDigit}`
  | `${OctalDigit}${OctalDigit}${OctalDigit}${OctalDigit}`;

type Id = `${number}`;
type Name = string;
export type ChownSpec =
  | `${Name}` // owner
  | `${Name}:${Name}` // owner:group
  | `${Name}.${Name}` // owner.group
  | `:${Name}` // group only (common)
  | `.${Name}` // group only (dot form)
  | `${Id}` // uid
  | `${Id}:${Id}` // uid:gid
  | `${Id}.${Id}`; // uid.gid
