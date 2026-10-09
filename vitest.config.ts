import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    // The balance bots are slow; run them with `npm run balance`.
    exclude: [...configDefaults.exclude, '**/__bench__/**'],
  },
});
