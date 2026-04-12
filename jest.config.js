module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: ["dotenv/config"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!src/index.ts"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
