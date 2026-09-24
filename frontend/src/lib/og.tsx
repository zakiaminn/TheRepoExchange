// Shared bits for the generated Open Graph images (app/opengraph-image.tsx and
// the per-repo one under app/asset/...). Kept in one place so both cards share
// the same palette, type, lockup, dimensions, and host string.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_URL } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// The ground is the logo's own tint (public/trx-logo.png), not Chalk: the Sulfur
// X only holds up against this pale yellow, and the card should read as the
// same object as the logo.
export const OG = {
  ground: "#EFF0CE",
  ink: "#16160E",
  ink2: "#4A4A3A",
  ink3: "#6A6A55",
  rule: "#D6D8AE",
  brand: "#DCEC3A", // Sulfur
} as const;

// The bare host, e.g. "therepo.exchange", used in the footer.
export const OG_HOST = SITE_URL.replace(/^https?:\/\//, "");

// Bricolage Grotesque, the brand face. Satori (inside next/og) only reads
// ttf/otf and next/font ships woff2, so static instances live in assets/og.
// Read with process.cwd() + a literal path so Next traces them into the build.
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600; style: "normal" }[]> | null = null;

export function ogFonts() {
  fonts ??= Promise.all(
    ([400, 600] as const).map(async (weight) => ({
      name: "Bricolage",
      data: await readFile(join(process.cwd(), `assets/og/Bricolage-${weight}.ttf`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

// The logo lockup: "TRX" with the Sulfur X, beside "THE REPO" over "Exchange".
// Rebuilt as type rather than embedding the PNG so it stays sharp at any size.
// `s` is the cap height of TRX in px; everything else scales from it.
export function Lockup({ s }: { s: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: s * 0.28 }}>
      <div
        style={{
          display: "flex",
          fontSize: s * 1.4,
          fontWeight: 600,
          letterSpacing: s * 0.02,
          lineHeight: 1,
          color: OG.ink,
        }}
      >
        TR<span style={{ color: OG.brand }}>X</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, color: OG.ink }}>
        <div style={{ display: "flex", fontSize: s * 0.9, fontWeight: 600 }}>THE REPO</div>
        <div style={{ display: "flex", fontSize: s * 0.78, fontWeight: 600, marginTop: s * 0.14 }}>
          Exchange
        </div>
      </div>
    </div>
  );
}

// The footer both cards share: host on the left, a plain note on the right.
export function Footer({ note }: { note: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: `1.5px solid ${OG.rule}`,
        paddingTop: 26,
        fontSize: 24,
        color: OG.ink3,
      }}
    >
      <div style={{ display: "flex" }}>{OG_HOST}</div>
      <div style={{ display: "flex" }}>{note}</div>
    </div>
  );
}
