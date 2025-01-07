import { all, Config, Input, Output } from '@pulumi/pulumi';
import { PodResources } from './k8s';

export type AdhocEnv = { isAdhocEnv: boolean };

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
  requests: Input<PodResources>,
): Output<Omit<PodResources, 'cpu'>> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return all([requests]).apply(([{ cpu, ...rest }]) => rest);
}

export const gcpProjectNumber = () => {
  const __config = new Config();
  return __config.require('projectNumber');
};
