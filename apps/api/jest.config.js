export default {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  globalSetup: "<rootDir>/tests/config/globalSetup.js",
  setupFiles: ["<rootDir>/tests/config/setupEnv.js"],
  maxWorkers: 1,
  clearMocks: true,
  verbose: true,
  testTimeout: 20000,
  collectCoverageFrom: ["src/**/*.js", "!src/server.js"],
};
