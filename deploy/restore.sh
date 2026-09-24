#!/bin/sh
# استرجاع نسخة احتياطية في قاعدة بيانات فاضية (للتجربة الشهرية أو للطوارئ)
# الاستخدام:  docker compose exec backup restore.sh /backups/rondi_2026-09-24_0200.sql.gz.enc rondi_restore_test
set -eu
file="${1:?backup file}"
target="${2:?target database name (must not be the live database)}"
[ "$target" = "$PGDATABASE" ] && { echo "refusing to overwrite the live database"; exit 1; }
sha256sum -c "$file.sha256"
createdb "$target"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$file" | gunzip | psql -q -v ON_ERROR_STOP=1 "$target"
echo "✔ restored into $target — tables:"
psql -At "$target" -c "select count(*) from users" | sed 's/^/  users: /'
psql -At "$target" -c "select * from rondi_audit_verify()" | grep -q . && echo "  ✘ audit chain broken" || echo "  ✔ audit chain intact"
