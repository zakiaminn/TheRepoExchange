import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OG_CONTENT_TYPE, OG_HOST } from "@/lib/og";
import { SITE_NAME, SITE_SHORT } from "@/lib/site";

export const alt = `${SITE_SHORT} · ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// The TRX mark, rebuilt from divs (a Sulfur square crossed by an ink X) so the
// image needs no external asset and no font — the two things that make next/og
// routes flaky. `s` is the square's side in px.
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

export default function Image() {
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
          // A hairline frame with a Sulfur cap rail — the "Bureau" ruled look.
          border: `1px solid ${OG.rule}`,
          borderTop: `10px solid ${OG.brand}`,
        }}
      >
        {/* masthead: mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Mark s={64} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
              {SITE_SHORT}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: OG.ink3,
                marginTop: 2,
              }}
            >
              {SITE_NAME}
            </div>
          </div>
        </div>

        {/* headline + gloss */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2.5,
            }}
          >
            A market in open source.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 400,
              color: OG.ink2,
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            Listings priced from live GitHub activity. Settlement is simulated.
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
            letterSpacing: 1,
            color: OG.ink3,
          }}
        >
          <div style={{ display: "flex", fontWeight: 500 }}>{OG_HOST}</div>
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
            Simulated · not investment advice
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
