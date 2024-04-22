export const charts = {
  redis: {
    chart: 'redis',
    version: '19.0.2',
    repositoryOpts: {
      repo: 'https://charts.bitnami.com/bitnami',
    },
  },
  'redis-cluster': {
    chart: 'redis-cluster',
    version: '10.0.2',
    repositoryOpts: {
      repo: 'https://charts.bitnami.com/bitnami',
    },
  },
} as const;
