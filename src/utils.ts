import { all, Input, Output } from '@pulumi/pulumi';
import { Limits } from './k8s';

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
  requests: Input<Limits>,
): Output<Omit<Limits, 'cpu'>> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return all([requests]).apply(([{ cpu, ...rest }]) => rest);
}
