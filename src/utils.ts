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
