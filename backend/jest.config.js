module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/database/init.js',
  ],
  coverageThreshold: {
    global: { lines: 60 },
  },
  setupFiles: ['./tests/setup.js'],
}
