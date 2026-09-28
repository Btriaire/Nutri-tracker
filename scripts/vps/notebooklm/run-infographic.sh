#!/bin/bash
# Wrapper Ammanda infographie : génère (Docker NotebookLM), compresse en JPEG, envoie à Nutri-Tracker.
# Usage : run-infographic.sh 7d|30d   (cron : dimanche 01:00 UTC = semaine, le 1er 02:30 UTC = mois)
set -eu

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE="notebooklm-nutri"
PERIOD="${1:-7d}"
case "$PERIOD" in 7d) LABEL="semaine"; DAYS=7 ;; 30d) LABEL="mois"; DAYS=30 ;; *) echo "Période inconnue: $PERIOD" >&2; exit 1 ;; esac

# Un seul job NotebookLM à la fois (le profil garde un "notebook courant" partagé).
exec 9>/tmp/notebooklm-nutri.lock
flock -w 1800 9 || { echo "Verrou NotebookLM occupé, abandon." >&2; exit 1; }

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "[$(date -u +%FT%TZ)] Image '$IMAGE' introuvable, reconstruction..."
  docker build -t "$IMAGE" "$DIR"
fi

START=$(date +%s)
docker run --rm \
  --env-file "$DIR/.env" \
  -v "$DIR/creds:/root/.notebooklm/profiles" \
  -v "$DIR/output:/output" \
  -v "$DIR/infographic.sh:/infographic.sh:ro" \
  --entrypoint /bin/sh \
  "$IMAGE" /infographic.sh "$PERIOD"

PNG=$(find "$DIR/output" -maxdepth 1 -name "nutri-infographie-${LABEL}-*.png" -newermt "@$START" | sort | tail -1)
[ -n "$PNG" ] || { echo "Aucune infographie produite." >&2; exit 1; }
echo "PNG: $PNG"

set -a; . "$DIR/.env"; set +a
python3 "$DIR/upload-infographic.py" "$PNG" "$LABEL" "$DAYS"

if [ -n "${NTFY_TOPIC:-}" ]; then
  curl -s -H "Title: Infographie Nutri-Tracker prête (${LABEL})" -d "Disponible dans Rapports > Historique." "ntfy.sh/${NTFY_TOPIC}" >/dev/null || true
fi
echo "Terminé."
