/**
 * `#*` subpath imports (see package.json "imports") resolve with no extra
 * `resolve.alias` config here — verified empirically: Vite applies its
 * `development` resolution condition by default outside a production build,
 * which matches the condition package.json's imports map uses to point `#*`
 * at ./src/* instead of ./dist/*.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/setup/global-setup.ts'],
    setupFiles: ['./tests/setup/test-setup.ts'],
    // Integration tests share one in-memory replica set (started once in
    // globalSetup) and clear collections between tests rather than
    // isolating per-file — running test files in parallel workers would
    // race on that shared state.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      // No enforced thresholds yet — with almost no business logic built,
      // a number chosen now would be arbitrary. Set real thresholds once
      // feature modules exist and a meaningful baseline is visible.
    },
  },
});
