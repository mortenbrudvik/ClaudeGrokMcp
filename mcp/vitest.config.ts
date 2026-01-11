import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Test file patterns - excludes live integration tests
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'src/integration/**'],

    // Global test utilities
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',

      // Coverage thresholds - fail if below threshold
      // Note: branches at 78% due to hard-to-test async queue processing
      thresholds: {
        branches: 78,
        functions: 80,
        lines: 80,
        statements: 80,
      },

      // Files to include in coverage
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**/*.ts',
        'src/test/**/*.ts',
        'src/integration/**/*.ts',
      ],
    },

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // Timeout configuration
    testTimeout: 10000,
    hookTimeout: 10000,

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
