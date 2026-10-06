#!/usr/bin/env python3
"""Archive permanente des photos du visage et de l'oeil sur le VPS, une photo = un fichier.

Usage : extract-photos.py <sauvegarde.json.gz> <dossier> <face|eye>

- Ecrit chaque photo en JPEG : <date>[_<heure>]_<id>.jpg (jamais reecrite ni supprimee, meme si le scan
  est efface dans l'appli : c'est une archive).
- A cote, <meme nom>.json : mesures, index memorises, analyse (mis a jour si les mesures changent).
- index.csv : une ligne par scan (date, qualite, index principaux) pour un coup d'oeil rapide.
"""
import base64, csv, gzip, json, os, re, sys

src, out, kind = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
with gzip.open(src, "rt", encoding="utf-8") as f:
    data = json.load(f)
docs = data.get("faceScans" if kind == "face" else "eyeScans", [])
field = "faceImageUrl" if kind == "face" else "image"
new_photos = updated = 0
rows = []
for d in docs:
    sid = re.sub(r"[^\w-]", "", str(d.get("id", "")))
    date = re.sub(r"[^\d-]", "", str(d.get("date", "")))
    if not sid or not date:
        continue
    time = re.sub(r"[^\d]", "", str(d.get("time", "")))
    base = f"{date}_{time}_{sid}" if time else f"{date}_{sid}"
    img = d.get(field)
    m = re.match(r"^data:image/[\w.+-]+;base64,(.+)$", img or "")
    jpg = os.path.join(out, base + ".jpg")
    if m and not os.path.exists(jpg):
        with open(jpg + ".tmp", "wb") as w:
            w.write(base64.b64decode(m.group(1)))
        os.replace(jpg + ".tmp", jpg)
        new_photos += 1
    # Oeil : photos isolees de chaque oeil, en plus de la photo des deux yeux
    if kind == "eye":
        for f, suffix in (("imageA", "_oeil-droit"), ("imageB", "_oeil-gauche")):
            mm = re.match(r"^data:image/[\w.+-]+;base64,(.+)$", d.get(f) or "")
            pth = os.path.join(out, base + suffix + ".jpg")
            if mm and not os.path.exists(pth):
                with open(pth + ".tmp", "wb") as w:
                    w.write(base64.b64decode(mm.group(1)))
                os.replace(pth + ".tmp", pth)
                new_photos += 1
    meta = {k: v for k, v in d.items() if k not in (field, "imageA", "imageB")}
    side = os.path.join(out, base + ".json")
    text = json.dumps(meta, ensure_ascii=False, indent=1, sort_keys=True)
    old = open(side, encoding="utf-8").read() if os.path.exists(side) else None
    if old != text:
        with open(side + ".tmp", "w", encoding="utf-8") as w:
            w.write(text)
        os.replace(side + ".tmp", side)
        updated += 1
    met = d.get("metrics") or {}
    idx = d.get("indexes") or {}
    q = (met.get("quality") or {}).get("score", "")
    if kind == "face":
        rows.append([date, sid, q, idx.get("volume", ""), idx.get("fatigue", ""), idx.get("teint", ""), met.get("cernes", ""), met.get("carotenoides", "")])
    else:
        rows.append([date, time, sid, q, idx.get("secheresse", ""), idx.get("fatigue", ""), idx.get("coloration", ""), d.get("mbiS", "")])

rows.sort()
header = ["date", "id", "qualite", "index_volume", "index_fatigue", "index_teint", "cernes", "carotenoides"] if kind == "face" \
    else ["date", "heure", "id", "qualite", "index_secheresse", "index_fatigue", "index_coloration", "sans_cligner_s"]
with open(os.path.join(out, "index.csv.tmp"), "w", newline="", encoding="utf-8") as w:
    csv.writer(w).writerows([header] + rows)
os.replace(os.path.join(out, "index.csv.tmp"), os.path.join(out, "index.csv"))
print(f"{kind}: {len(docs)} scans, {new_photos} nouvelles photos, {updated} fiches mises a jour")
