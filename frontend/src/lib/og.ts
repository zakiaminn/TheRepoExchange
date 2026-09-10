// Shared bits for the generated Open Graph images (app/opengraph-image.tsx and
// the per-repo one under app/asset/...). Kept in one place so both share the
// same palette, dimensions, and host string.

import { SITE_URL } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// Sulfur on Chalk — the locked TRX palette (light-theme values from
// globals.css). OG cards are the same picture everywhere they appear, so we
// commit to the light ground rather than trying to detect a viewer theme.
export const OG = {
  paper: "#FAFAF9", // Chalk
  paper2: "#F1F1EE",
  ink: "#16160E",
  ink2: "#565448",
  ink3: "#6E6C60",
  rule: "#E5E5E1",
  rule2: "#D8D8D2",
  brand: "#DCEC3A", // Sulfur signal
  brandInk: "#6F7A00", // text-safe olive on Chalk
  brandFg: "#16160E",
} as const;

// The bare host, e.g. "therepo.exchange" — used as the footer wordmark.
export const OG_HOST = SITE_URL.replace(/^https?:\/\//, "");

// NOTE ON TYPE: these cards render in next/og's bundled default font. The brand
// face is Bricolage Grotesque, but Satori (inside next/og) only parses ttf/otf,
// and next/font ships Bricolage as woff2 — so matching the brand type here
// means vendoring a Bricolage *.ttf into the repo and reading it with
// readFile() at module scope (the pattern in the next/og docs). Deferred on
// purpose: a working card in the brand colours and layout ships now; the exact
// typeface is a follow-up that doesn't touch anything else.
