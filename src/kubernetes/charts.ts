export const charts = {
  redis: {
    chart: 'redis',
    version: '20.0.3',
    repositoryOpts: {
      repo: 'https://charts.bitnami.com/bitnami',
    },
  },
  'redis-cluster': {
    chart: 'redis-cluster',
    version: '11.0.3',
    repositoryOpts: {
      repo: 'https://charts.bitnami.com/bitnami',
    },
  },
} as const;
