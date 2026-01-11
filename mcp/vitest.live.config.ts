/**
 * Vitest Configuration for Live Integration Tests
 *
 * Runs tests against the real xAI API.
 * Use: npm run test:live
 *
 * WARNING: These tests cost money! Budget is enforced at $0.10 per run.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Only include live test files
    include: ['src/integration/**/*.live.test.ts'],
    exclude: ['node_modules', 'dist'],

    // Global test utilities
    globals: true,

    // Longer timeouts for API calls
    testTimeout: 60000,
    hookTimeout: 30000,

    // Run sequentially to avoid rate limits
    // Vitest 4.x: poolOptions moved to top-level
    isolate: false,
    sequence: {
      concurrent: false,
    },

    // Setup file for live tests
    setupFiles: ['./src/integration/setup.ts'],

    // No coverage for live tests (costs money to re-run failures)
    coverage: {
      enabled: false,
    },

    // Reporter configuration
    reporters: ['default'],

    // Watch mode exclusions
    watchExclude: ['node_modules', 'dist', 'coverage'],
  },

  // Resolve aliases matching tsconfig
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
