import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/icons");
const appDir = path.resolve(__dirname, "../app");
mkdirSync(outDir, { recursive: true });

// Pack PNG buffers into a modern "PNG-in-ICO" .ico file (supported since Vista/modern browsers)
function packIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const imageData = [];
  let offset = 6 + count * 16;

  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);  // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1);  // height
    entry.writeUInt8(0, 2);   // color count
    entry.writeUInt8(0, 3);   // reserved
    entry.writeUInt16LE(1, 4);  // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(buf.length, 8);  // bytes in resource
    entry.writeUInt32LE(offset, 12);     // offset
    dirEntries.push(entry);
    imageData.push(buf);
    offset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageData]);
}

// ─── Standard icon (rounded-square background, safe for favicon/apple/any) ───
const iconSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="55%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="512" height="512" rx="112" fill="url(#glow)"/>

  <!-- Ascending arrow trail -->
  <path d="M 148 300 L 233 232 L 305 274 L 388 132"
        fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="14"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 388 132 L 388 178 M 388 132 L 342 138"
        fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="14" stroke-linecap="round"/>

  <!-- Bar chart -->
  <rect x="140" y="300" width="62" height="112" rx="16" fill="url(#bar)"/>
  <rect x="225" y="256" width="62" height="156" rx="16" fill="url(#bar)"/>
  <rect x="310" y="204" width="62" height="208" rx="16" fill="url(#bar)"/>

  <!-- Leaf sprouting from the tallest bar -->
  <g transform="translate(341,150) rotate(-18)">
    <path d="M 0 46
             C -30 30 -34 -18 -4 -46
             C 34 -30 40 18 8 46
             C 5 48 3 47 0 46 Z"
          fill="#ffffff"/>
    <path d="M -12 34 C -6 12 2 -8 10 -30"
          fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round"/>
  </g>
</svg>
`.trim();

// ─── Maskable icon (full-bleed background, mark within safe zone ~70%) ───
const maskableSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="55%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#glow)"/>

  <g transform="translate(256,266) scale(0.82) translate(-256,-256)">
    <path d="M 148 300 L 233 232 L 305 274 L 388 132"
          fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="14"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 388 132 L 388 178 M 388 132 L 342 138"
          fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="14" stroke-linecap="round"/>

    <rect x="140" y="300" width="62" height="112" rx="16" fill="url(#bar)"/>
    <rect x="225" y="256" width="62" height="156" rx="16" fill="url(#bar)"/>
    <rect x="310" y="204" width="62" height="208" rx="16" fill="url(#bar)"/>

    <g transform="translate(341,150) rotate(-18)">
      <path d="M 0 46
               C -30 30 -34 -18 -4 -46
               C 34 -30 40 18 8 46
               C 5 48 3 47 0 46 Z"
            fill="#ffffff"/>
      <path d="M -12 34 C -6 12 2 -8 10 -30"
            fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round"/>
    </g>
  </g>
</svg>
`.trim();

writeFileSync(path.join(outDir, "icon-source.svg"), iconSVG);
writeFileSync(path.join(outDir, "maskable-source.svg"), maskableSVG);

const targets = [
  { name: "preview-1024.png", svg: iconSVG, size: 1024 },
];

const sizes = [16, 32, 48, 96, 152, 167, 180, 192, 256, 384, 512];

async function run() {
  for (const size of sizes) {
    await sharp(Buffer.from(iconSVG)).resize(size, size).png().toFile(path.join(outDir, `icon-${size}.png`));
  }
  await sharp(Buffer.from(maskableSVG)).resize(512, 512).png().toFile(path.join(outDir, "maskable-512.png"));
  await sharp(Buffer.from(maskableSVG)).resize(192, 192).png().toFile(path.join(outDir, "maskable-192.png"));

  for (const t of targets) {
    await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toFile(path.join(outDir, t.name));
  }

  // Build a real multi-resolution favicon.ico (16/32/48) and drop it into app/
  const icoSizes = [16, 32, 48];
  const pngBuffers = [];
  for (const size of icoSizes) {
    const buf = await sharp(Buffer.from(iconSVG)).resize(size, size).png().toBuffer();
    pngBuffers.push({ size, buf });
  }
  writeFileSync(path.join(appDir, "favicon.ico"), packIco(pngBuffers));

  // App-router auto-detected icon + apple touch icon
  await sharp(Buffer.from(iconSVG)).resize(512, 512).png().toFile(path.join(appDir, "icon.png"));
  await sharp(Buffer.from(iconSVG)).resize(180, 180).png().toFile(path.join(appDir, "apple-icon.png"));

  console.log("Icons generated in", outDir, "+ app/favicon.ico, app/icon.png, app/apple-icon.png");
}

run().catch(e => { console.error(e); process.exit(1); });
