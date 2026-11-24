// Generates the PNG icons required by the web app manifest and iOS from the
// source SVG (static/pwa-icon.svg). Run with: node scripts/generate-pwa-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "static", "pwa-icon.svg");
const outDir = join(root, "static", "icons");

const targets = [
  // Also used by the PWA manifest (128x128 PNG).
  { name: "icon-128.png", size: 128 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  // Maskable icon: extra padding so non-critical art stays inside the safe zone.
  { name: "maskable-512.png", size: 512, padding: 0.12 },
  { name: "apple-touch-icon.png", size: 180 }
];

const svg = await readFile(src);
await writeFile(join(outDir, ".keep"), "", { flag: "w" }).catch(() => {});

for (const { name, size, padding = 0 } of targets) {
  let buf = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png()
    .toBuffer();

  if (padding > 0) {
    const inset = Math.round(size * padding);
    const inner = size - inset * 2;
    const art = await sharp(svg, { density: 384 })
      .resize(inner, inner, { fit: "contain" })
      .png()
      .toBuffer();
    const padded = await sharp(art)
      .extend({
        top: inset,
        bottom: inset,
        left: inset,
        right: inset,
        background: "#5b8a8a"
      })
      .png()
      .toBuffer();
    // Materialise before resizing: chaining resize after extend on the SVG
    // pipeline lets Sharp reapply the SVG density and produces a wrong size.
    buf = await sharp(padded).resize(size, size).png().toBuffer();
  }

  await writeFile(join(outDir, name), buf);
  console.log("wrote", name, `${size}x${size}`);
}
