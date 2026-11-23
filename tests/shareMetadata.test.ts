import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const html = readFileSync(root + "index.html", "utf8");
const canonical = "https://containers.yaslogist.com/";
const coverUrl = canonical + "og-uld360-v1.jpg";

function meta(property: string): string | undefined {
  const tags = [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => match[0]);
  const tag = tags.find((item) => item.includes('property="' + property + '"'));
  return tag?.match(/\bcontent="([^"]+)"/)?.[1];
}

function jpegDimensions(data: Buffer): { width: number; height: number } {
  assert.equal(data.readUInt16BE(0), 0xffd8, "The share cover must be JPEG");
  let offset = 2;
  while (offset + 8 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    assert.ok(offset + 2 <= data.length, "Truncated JPEG segment");
    const length = data.readUInt16BE(offset);
    assert.ok(length >= 2 && offset + length <= data.length, "Invalid JPEG segment");
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: data.readUInt16BE(offset + 3), width: data.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error("JPEG has no supported size marker");
}

test("ULD360 social metadata, canonical and share card remain consistent", () => {
  assert.match(html, /<title>ULD360 \| YASLOGIST Air Cargo Engineering Lab<\/title>/);
  assert.ok(html.includes('<link rel="canonical" href="' + canonical + '" />'));
  assert.equal(meta("og:type"), "website");
  assert.equal(meta("og:url"), canonical);
  assert.equal(meta("og:site_name"), "YASLOGIST");
  assert.equal(meta("og:title"), "ULD360 | YASLOGIST Air Cargo Engineering Lab");
  assert.equal(meta("og:image"), coverUrl);
  assert.equal(meta("og:image:secure_url"), coverUrl);
  assert.equal(meta("og:image:type"), "image/jpeg");
  assert.ok(meta("og:description")?.includes("not an approved loading tool"));
  assert.ok(meta("og:image:alt")?.includes("YASLOGIST ULD360"));
});

test("share image dimensions match declared Open Graph dimensions", () => {
  const cover = readFileSync(root + "public/og-uld360-v1.jpg");
  assert.deepEqual(jpegDimensions(cover), { width: 1200, height: 630 });
  assert.equal(meta("og:image:width"), "1200");
  assert.equal(meta("og:image:height"), "630");
  assert.ok(cover.length > 50_000, "Share cover should not be an empty placeholder");
});
