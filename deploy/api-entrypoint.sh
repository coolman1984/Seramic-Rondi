#!/bin/sh
# قبل تشغيل الخادم: تطبيق أي تعديل جديد على شكل الجداول (بمستخدم صاحب القاعدة)
set -e
cd /app/apps/api
export HOME=/tmp
./node_modules/.bin/prisma migrate deploy
if [ "${RUN_SEED:-false}" = "true" ]; then
  node -r @swc-node/register prisma/seed.ts
fi
exec node dist/main.js
