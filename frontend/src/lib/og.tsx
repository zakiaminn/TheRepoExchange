// shared pieces for the generated open graph images (app/opengraph-image.tsx and the
// per-repo one under app/asset/...): palette, fonts, lockup, size and host

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_URL } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// the ground is the logo's own pale yellow tint (public/trx-logo.png), so the card reads
// as the same object as the logo
export const OG = {
  ground: "#EFF0CE",
  ink: "#16160E",
  ink2: "#4A4A3A",
  ink3: "#6A6A55",
  rule: "#D6D8AE",
  brand: "#DCEC3A", // sulfur
} as const;

// the bare host, e.g. "therepo.exchange", for the footer
export const OG_HOST = SITE_URL.replace(/^https?:\/\//, "");

// bricolage grotesque, the brand face. satori (inside next/og) only reads ttf/otf and
// next/font ships woff2, so static instances live in assets/og. they're read with
// process.cwd() + a literal path so next traces them into the build
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

// the logo lockup: "TRX" with a sulfur "X", beside "THE REPO" over "Exchange". it's set
// as type instead of the png so it stays sharp at any size. `s` is the cap height of the
// wordmark in px and everything else scales from it
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

// the footer both cards share: host on the left, a note on the right
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
