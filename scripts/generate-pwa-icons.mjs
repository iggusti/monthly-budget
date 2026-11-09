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
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  // Maskable icon: extra padding so non-critical art stays inside the safe zone.
  { name: "maskable-512.png", size: 512, padding: 0.12 },
  { name: "apple-touch-icon.png", size: 180 }
];

const svg = await readFile(src);
await writeFile(join(outDir, ".keep"), "", { flag: "w" }).catch(() => {});

for (const { name, size, padding = 0 } of targets) {
  let img = sharp(svg, { density: 384 }).resize(size, size, { fit: "contain" });
  if (padding > 0) {
    const inner = Math.round(size * (1 - padding * 2));
    img = sharp(svg, { density: 384 })
      .resize(inner, inner, { fit: "contain" })
      .extend({
        top: Math.round(size * padding),
        bottom: Math.round(size * padding),
        left: Math.round(size * padding),
        right: Math.round(size * padding),
        background: "#1a1714"
      })
      .resize(size, size);
  }
  const buf = await img.png().toBuffer();
  await writeFile(join(outDir, name), buf);
  console.log("wrote", name, `${size}x${size}`);
}
