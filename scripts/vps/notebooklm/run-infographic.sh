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
python3 - "$PNG" "$LABEL" "$DAYS" <<'PY'
import base64, io, json, os, re, sys, urllib.request
from datetime import date, timedelta
from PIL import Image

png, label, days = sys.argv[1], sys.argv[2], int(sys.argv[3])
to = re.search(r"(\d{4}-\d{2}-\d{2})\.png$", png).group(1)
frm = (date.fromisoformat(to) - timedelta(days=days)).isoformat()

img = Image.open(png).convert("RGB")
# NotebookLM appose sa marque dans le coin bas-droit : on retire la bande du bas et on signe nous-memes.
img = img.crop((0, 0, img.width, img.height - round(img.height * 0.04)))
from PIL import ImageDraw, ImageFont
band = round(img.height * 0.03)
canvas = Image.new("RGB", (img.width, img.height + band), img.getpixel((img.width // 2, img.height - 2)))
canvas.paste(img, (0, 0))
draw = ImageDraw.Draw(canvas)
font = ImageFont.load_default(size=max(20, img.width // 50))
mark = "Rapport NutriTracker PaLaMA"
w = draw.textlength(mark, font=font)
draw.text(((img.width - w) / 2, img.height + (band - font.size) / 2 - 2), mark, fill=(110, 110, 125), font=font)
img = canvas
data = None
for width, quality in [(1400, 84), (1400, 74), (1200, 72), (1000, 70), (900, 62)]:
    im = img if img.width <= width else img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=quality, optimize=True)
    if buf.tell() <= 650_000:
        data = buf.getvalue(); break
if data is None:
    sys.exit("Image trop lourde même après compression")

jpg = png[:-4] + ".jpg"
open(jpg, "wb").write(data)
body = json.dumps({"period": label, "from": frm, "to": to, "title": f"Infographie {label} au {to}",
                   "imageBase64": base64.b64encode(data).decode()}).encode()
req = urllib.request.Request(os.environ["NUTRI_TRACKER_URL"].rstrip("/") + "/api/infographic/upload", data=body, method="POST",
    headers={"Content-Type": "application/json", "Authorization": "Bearer " + os.environ["REPORT_CRON_SECRET"]})
with urllib.request.urlopen(req, timeout=60) as r:
    print("Envoyé à Nutri-Tracker:", r.status, r.read().decode(), f"({len(data)//1024} Ko)")
PY

if [ -n "${NTFY_TOPIC:-}" ]; then
  curl -s -H "Title: Infographie Nutri-Tracker prête (${LABEL})" -d "Disponible dans Rapports > Historique." "ntfy.sh/${NTFY_TOPIC}" >/dev/null || true
fi
echo "Terminé."
