#!/bin/sh
# بيتنفذ مرة واحدة أول ما قاعدة البيانات تتعمل:
# مستخدم خاص بالتطبيق صلاحياته قراءة وإضافة وتعديل بس — مفيش مسح ولا تفريغ جداول ولا تعديل شكلها.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE rondi_app LOGIN PASSWORD '${APP_DB_PASSWORD}';
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO rondi_app;
GRANT USAGE ON SCHEMA public TO rondi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO rondi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO rondi_app;
SQL
