export const charts = {
  redis: {
    chart: 'redis',
    version: '19.6.4',
    repositoryOpts: {
      repo: 'https://charts.bitnami.com/bitnami',
    },
  },
  'redis-cluster': {
    chart: 'redis-cluster',
    version: '10.3.0',
    repositoryOpts: {
      repo: 'https://charts.bitnami.com/bitnami',
    },
  },
} as const;
