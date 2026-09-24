import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OG_CONTENT_TYPE, OG_HOST } from "@/lib/og";
import { SITE_SHORT } from "@/lib/site";

export const alt = "Listing on The Repo Exchange";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// The TRX mark rebuilt from divs — no external asset, no font. See the root
// opengraph-image for the rationale.
function Mark({ s }: { s: number }) {
  const bar = { position: "absolute" as const, width: s * 0.62, height: s * 0.11, background: OG.ink };
  return (
    <div
      style={{
        width: s,
        height: s,
        background: OG.brand,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div style={{ ...bar, transform: "rotate(45deg)" }} />
      <div style={{ ...bar, transform: "rotate(-45deg)" }} />
    </div>
  );
}

// A per-listing share card. Identity only (owner + repo),
// drawn straight from the route params. Deliberately no price: it would need a
// network call (a failure mode on a cached image) and a mark shown out of
// context reads as a quote it isn't.
export default async function Image({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OG.paper,
          color: OG.ink,
          padding: "72px 80px",
          border: `1px solid ${OG.rule}`,
          borderTop: `10px solid ${OG.brand}`,
        }}
      >
        {/* masthead: mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Mark s={48} />
          <div style={{ display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
            {SITE_SHORT}
          </div>
        </div>

        {/* the security's identity: owner over a large repo name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 500,
              color: OG.ink2,
              letterSpacing: 0.5,
            }}
          >
            {owner}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 128,
              fontWeight: 800,
              lineHeight: 0.98,
              letterSpacing: -3,
              textTransform: "uppercase",
              overflow: "hidden",
            }}
          >
            {repo}
          </div>
        </div>

        {/* footer rule */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${OG.rule2}`,
            paddingTop: 24,
            fontSize: 20,
            color: OG.ink3,
          }}
        >
          <div style={{ display: "flex", fontWeight: 500, letterSpacing: 1 }}>{OG_HOST}</div>
          <div
            style={{
              display: "flex",
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: OG.brandInk,
            }}
          >
            Priced from GitHub activity
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
