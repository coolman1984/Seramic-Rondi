module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['@swc/jest'] },
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
