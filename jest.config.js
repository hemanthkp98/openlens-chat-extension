module.exports = {
  projects: [
    {
      displayName: "frontend",
      testEnvironment: "jsdom",
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }]
      },
      testMatch: ["<rootDir>/src/__tests__/**/*.test.(ts|tsx)"],
      setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
      moduleNameMapper: {
        "\\.module\\.css$": "<rootDir>/__mocks__/styleMock.js"
      }
    },
    {
      displayName: "backend",
      testEnvironment: "node",
      testMatch: ["<rootDir>/__tests__/**/*.test.js"]
    }
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  }
};
