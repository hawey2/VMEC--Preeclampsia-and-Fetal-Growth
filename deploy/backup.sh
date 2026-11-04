#!/bin/sh
# Nightly encrypted database backup. Run from cron on the server, e.g.:
#   15 1 * * * /opt/pe-risk/deploy/backup.sh /mnt/vinmec-backup/pe-risk
# Needs: BACKUP_PASSPHRASE in the environment (or in /opt/pe-risk/deploy/backup.env).
set -eu
DEST="${1:?usage: backup.sh <backup directory>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$HERE/backup.env" ] && . "$HERE/backup.env"
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"
STAMP="$(date +%Y-%m-%d)"
mkdir -p "$DEST"
docker compose -f "$HERE/docker-compose.yml" exec -T db pg_dump -U pe -Fc pe \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$DEST/pe-$STAMP.dump.enc"
# Keep 30 days.
find "$DEST" -name 'pe-*.dump.enc' -mtime +30 -delete
echo "backup written: $DEST/pe-$STAMP.dump.enc"

# Restore (test monthly on a spare database):
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in pe-YYYY-MM-DD.dump.enc \
#     | docker compose exec -T db pg_restore -U pe -d pe --clean
