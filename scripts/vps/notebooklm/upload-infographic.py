import base64, io, json, os, re, sys, urllib.request
from datetime import date, timedelta
from PIL import Image

png, label, days = sys.argv[1], sys.argv[2], int(sys.argv[3])
to = re.search(r"(\d{4}-\d{2}-\d{2})[^/]*\.png$", png).group(1)
frm = (date.fromisoformat(to) - timedelta(days=days)).isoformat()

img = Image.open(png).convert("RGB")
# NotebookLM appose sa marque dans le coin bas-droit : on retire la bande du bas et on signe nous-memes.
img = img.crop((0, 0, img.width, img.height - round(img.height * 0.015)))
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
