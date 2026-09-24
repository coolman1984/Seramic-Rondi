module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  transform: { '^.+\\.(t|j)s$': ['@swc/jest'] },
  // مكتبة الرمز الإضافي مكتوبة بصيغة ESM، فلازم تتحول للاختبارات
  transformIgnorePatterns: ['/node_modules/(?!(\\.pnpm|@scure|@noble|@otplib|otplib|@nestjs))'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  moduleNameMapper: { '^@rondi/shared$': '<rootDir>/../../packages/shared/src/index.ts' },
  setupFiles: ['<rootDir>/test/env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 30000,
  // كل الاختبارات بتستخدم نفس قاعدة بيانات الاختبار، فلازم تمشي واحد ورا التاني
  maxWorkers: 1,
};
