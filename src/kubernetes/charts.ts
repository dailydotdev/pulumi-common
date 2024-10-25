export const charts = {
  redis: {
    chart: 'redis',
    version: '20.2.1',
    repositoryOpts: {
      repo: 'https://charts.bitnami.com/bitnami',
    },
  },
  'redis-cluster': {
    chart: 'redis-cluster',
    version: '11.0.6',
    repositoryOpts: {
      repo: 'https://charts.bitnami.com/bitnami',
    },
  },
} as const;
