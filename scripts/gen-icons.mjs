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
  <rect width="512" height="512" rx="112" fill="#10b981"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="52"/>
  <path d="M256 106 A 150 150 0 1 1 106 256" fill="none" stroke="#ffffff" stroke-width="52" stroke-linecap="round"/>
  <circle cx="106" cy="256" r="34" fill="#ffffff"/>
</svg>
`.trim();

// ─── Maskable icon (full-bleed background, mark within safe zone ~70%) ───
const maskableSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#10b981"/>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">
  <circle cx="256" cy="256" r="150" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="52"/>
  <path d="M256 106 A 150 150 0 1 1 106 256" fill="none" stroke="#ffffff" stroke-width="52" stroke-linecap="round"/>
  <circle cx="106" cy="256" r="34" fill="#ffffff"/>
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
