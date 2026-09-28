module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/WebApp/tests/lab12b/**/*.test.cjs'],
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '<rootDir>/prototypes/sprint1/Thakorn/thakorn_quizgenerator_view_model.js'
  ],
  coverageDirectory: '<rootDir>/WebApp/coverage/lab12b',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 100,
      lines: 95,
      statements: 95
    }
  }
};
