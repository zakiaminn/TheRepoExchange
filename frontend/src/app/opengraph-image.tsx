import { ImageResponse } from "next/og";
import { OG, OG_SIZE, OG_CONTENT_TYPE, Lockup, Footer, ogFonts } from "@/lib/og";
import { SITE_NAME, SITE_SHORT } from "@/lib/site";

export const alt = `${SITE_SHORT} · ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// the site-wide share card: the logo lockup, one line on what trx is, and the host
export default async function Image() {
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
          padding: "84px 88px 64px",
        }}
      >
        <Lockup s={96} />

        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 400,
            lineHeight: 1.3,
            color: OG.ink2,
            maxWidth: 860,
          }}
        >
          A market in open source. Listings are priced from live GitHub activity.
        </div>

        <Footer note="Settlement is simulated" />
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
