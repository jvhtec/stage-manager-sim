import { defineConfig } from 'vitest/config';
import path from 'path';

// Slow balance scripts (src/world/__bench__): `npm run balance`.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/world/__bench__/**/*.bench.ts'], testTimeout: 600_000 },
});
