// إعدادات الاختبار: قاعدة بيانات منفصلة ومفتاح تشفير للاختبار بس
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://rondi:rondi_dev_pw@localhost:5432/rondi_test';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.COOKIE_SECURE = 'false';
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.THROTTLE_LIMIT_PER_MINUTE ??= '100000';
process.env.THROTTLE_LOGIN_PER_MINUTE ??= '100000';
process.env.LOGIN_MAX_ATTEMPTS = '5';
process.env.LOGIN_LOCK_MINUTES = '15';
