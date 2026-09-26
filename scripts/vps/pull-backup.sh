#!/bin/bash
# Tire la sauvegarde nutri-tracker depuis l endpoint authentifie (rien n est publie sur Internet).
set -uo pipefail
DEST="/root/nutri-tracker-backups"
BASE="https://nutri-tracker-mocha.vercel.app/api/cron/backup"
SECRET=$(cat "$DEST/.secret")
DATE=$(date -u +%Y-%m-%d)
LOG="$DEST/pull.log"
mkdir -p "$DEST/photos"

pull() {  # $1 = set (vide = principal) ; $2 = fichier de sortie
  local url="$BASE"; [ -n "$1" ] && url="$BASE?set=$1"
  local tmp="$2.tmp"
  local code
  code=$(curl -s -m 150 -H "X-Cron-Secret: $SECRET" -o "$tmp" -w "%{http_code}" "$url")
  if [ "$code" = "200" ] && gzip -t "$tmp" 2>/dev/null && [ "$(stat -c%s "$tmp")" -gt 500 ]; then
    mv "$tmp" "$2"
    echo "$(date -u "+%F %T UTC") OK ${1:-main} $(stat -c%s "$2") bytes" >> "$LOG"
  else
    rm -f "$tmp"
    echo "$(date -u "+%F %T UTC") FAILED ${1:-main} HTTP $code" >> "$LOG"
    return 1
  fi
}

rc=0
pull "" "$DEST/nutri-tracker-$DATE.json.gz" || rc=1
if [ "$(date -u +%u)" = "7" ]; then
  for s in dayPhotos mealPhotos faceScans; do pull "$s" "$DEST/photos/nutri-tracker-$s-$DATE.json.gz" || rc=1; done
fi

# Rotation : 60 jours de quotidiens, puis seulement les sauvegardes du 1er du mois.
find "$DEST" -maxdepth 1 -name "nutri-tracker-20*.json.gz" -mtime +60 ! -name "*-01.json.gz" -delete
find "$DEST/photos" -name "*.json.gz" -mtime +60 ! -name "*-01.json.gz" -delete
exit $rc
