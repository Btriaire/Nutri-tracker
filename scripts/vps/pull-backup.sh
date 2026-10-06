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

# Mode "--if-requested" (cron toutes les 5 min) : ne sauvegarde que si demande depuis Reglages.
if [ "${1:-}" = "--if-requested" ]; then
  resp=$(curl -s -m 20 -H "X-Cron-Secret: $SECRET" "${BASE}-pending" || true)
  case "$resp" in *'"pending":true'*) ;; *) exit 0 ;; esac
  pull "" "$DEST/nutri-tracker-$(date -u +%Y-%m-%dT%H%M%S).json.gz"
  exit $?
fi

rc=0
pull "" "$DEST/nutri-tracker-$DATE.json.gz" || rc=1
# Visage et oeil : chaque jour, puis archive permanente photo par photo (JPEG + mesures/index en JSON)
for s in faceScans eyeScans; do
  f="$DEST/photos/nutri-tracker-$s-$DATE.json.gz"
  if pull "$s" "$f"; then
    kind=face; [ "$s" = "eyeScans" ] && kind=eye
    python3 "$DEST/extract-photos.py" "$f" "$DEST/archive/$kind" "$kind" >> "$LOG" 2>&1 || rc=1
  else rc=1; fi
done
if [ "$(date -u +%u)" = "7" ]; then
  for s in dayPhotos mealPhotos infographics; do pull "$s" "$DEST/photos/nutri-tracker-$s-$DATE.json.gz" || rc=1; done
fi

# Rotation : 60 jours de quotidiens, puis seulement les sauvegardes du 1er du mois.
# (Le dossier archive/ n'est jamais concerne : les photos du visage et de l'oeil y restent pour toujours.)
find "$DEST" -maxdepth 1 -name "nutri-tracker-20*.json.gz" -mtime +60 ! -name "*-01.json.gz" -delete
find "$DEST/photos" -name "*.json.gz" -mtime +60 ! -name "*-01.json.gz" -delete
exit $rc
