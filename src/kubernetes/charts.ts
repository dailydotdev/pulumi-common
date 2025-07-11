import type { ReleaseArgs } from '@pulumi/kubernetes/helm/v3';

export const charts: Record<string, ReleaseArgs> = {
  redis: {
    chart: 'redis',
    version: '20.2.1',
    repositoryOpts: {
      repo: 'https://repo.broadcom.com/bitnami-files',
    },
  },
  'redis-sentinel': {
    chart: 'oci://registry-1.docker.io/bitnamicharts/redis',
    version: '21.2.3',
  },
  'redis-cluster': {
    chart: 'redis-cluster',
    version: '11.0.6',
    repositoryOpts: {
      repo: 'https://repo.broadcom.com/bitnami-files',
    },
  },
} as const;
