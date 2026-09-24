#!/bin/sh
# ══════════════════════════════════════════════
# النسخ الاحتياطي التلقائي لقاعدة بيانات روندي
#  - كل يوم الساعة BACKUP_HOUR (افتراضي ٢ بالليل بتوقيت القاهرة)
#  - النسخة مضغوطة ومتشفرة (AES-256) بكلمة سر BACKUP_PASSPHRASE
#  - بيحتفظ بآخر BACKUP_KEEP_DAYS يوم (افتراضي ٣٠)
#  - لو BACKUP_OFFSITE_DIR متحدد (مثلاً فولدر على NAS)، بياخد نسخة تانية هناك
# تشغيل يدوي فوري:  docker compose exec backup backup.sh
# ══════════════════════════════════════════════
set -eu
: "${PGHOST:?}" "${PGUSER:?}" "${PGPASSWORD:?}" "${PGDATABASE:?}" "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
DIR="${BACKUP_DIR:-/backups}"
KEEP="${BACKUP_KEEP_DAYS:-30}"
HOUR="${BACKUP_HOUR:-2}"
export TZ="${TZ:-Africa/Cairo}"

run_backup() {
  mkdir -p "$DIR"
  stamp=$(date +%Y-%m-%d_%H%M)
  file="$DIR/rondi_${stamp}.sql.gz.enc"
  tmp="$file.partial"
  pg_dump --no-owner --no-privileges --format=plain "$PGDATABASE" \
    | gzip -9 \
    | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$tmp"
  mv "$tmp" "$file"
  sha256sum "$file" > "$file.sha256"
  echo "$(date '+%F %T') ✔ backup $(basename "$file") ($(du -h "$file" | cut -f1))"
  if [ -n "${BACKUP_OFFSITE_DIR:-}" ] && [ -d "$BACKUP_OFFSITE_DIR" ]; then
    cp "$file" "$file.sha256" "$BACKUP_OFFSITE_DIR"/ && echo "  ✔ offsite copy"
  fi
  find "$DIR" -name 'rondi_*.sql.gz.enc*' -mtime +"$KEEP" -delete
}

if [ "${1:-}" = "--daemon" ]; then
  echo "backup daemon started: daily at ${HOUR}:00 ($TZ), keep ${KEEP} days"
  while true; do
    now=$(date +%s)
    next=$(date -d "$(date +%Y-%m-%d) ${HOUR}:00" +%s 2>/dev/null || date -D '%Y-%m-%d %H:%M' -d "$(date +%Y-%m-%d) ${HOUR}:00" +%s)
    [ "$next" -le "$now" ] && next=$((next + 86400))
    sleep $((next - now))
    run_backup || echo "$(date '+%F %T') ✘ backup FAILED" >&2
  done
else
  run_backup
fi
