import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OG_CONTENT_TYPE, Lockup, Footer, ogFonts } from "@/lib/og";

export const alt = "Listing on The Repo Exchange";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Width the repo name has to fit in: the card minus its side padding.
const NAME_WIDTH = 1200 - 88 * 2;

// A per-listing share card. Identity only (owner + repo), drawn straight from
// the route params. Deliberately no price: it would need a network call (a
// failure mode on a cached image) and a mark shown out of context reads as a
// quote it isn't.
export default async function Image({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  // Shrink long names to one line instead of clipping them. 0.58em is a safe
  // average advance for Bricolage semibold in mixed case.
  const nameSize = Math.round(Math.min(120, NAME_WIDTH / (repo.length * 0.58)));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OG.ground,
          color: OG.ink,
          fontFamily: "Bricolage",
          padding: "72px 88px 64px",
        }}
      >
        <Lockup s={44} />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 400, color: OG.ink2 }}>
            {owner}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: nameSize,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: -nameSize * 0.02,
            }}
          >
            {repo}
          </div>
        </div>

        <Footer note="Priced from GitHub activity" />
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
