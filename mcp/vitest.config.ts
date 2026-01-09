import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Test file patterns
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],

    // Global test utilities
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',

      // Coverage thresholds - fail if below 80%
      thresholds: {
        branches: 80,
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
