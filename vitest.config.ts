import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "server/**/*.test.ts"],
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      // Business logic: the shared pure rules in lib/ and the server-side services.
      include: ["lib/**/*.ts", "server/services/**/*.ts"],
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
