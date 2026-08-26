import { ImageResponse } from "next/og";
import { getPublishedSite } from "@/lib/publishedSite";

export const alt = "Published with ScrollCraft";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * A social card for each published site, drawn from that site's own palette.
 *
 * Published pages previously had no image at all, so every share of a customer's site
 * rendered as a bare link. The card is built from the stored theme rather than the
 * frames: the frames live in the visitor's browser, not on the server.
 */
export default async function PublishedOGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublishedSite(slug);

  const ground = site?.theme?.ground ?? "#05070c";
  const ink = site?.theme?.ink ?? "#ffffff";
  const accent = site?.theme?.accent ?? "#7c3aed";
  const name = site?.name ?? "Published with ScrollCraft";
  const description = site?.description ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "80px",
          background: `linear-gradient(135deg, ${ground} 0%, ${accent}33 55%, ${ground} 100%)`,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 700,
            color: ink,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            // Long names must not run off the card.
            maxWidth: "1000px",
          }}
        >
          {name.length > 60 ? `${name.slice(0, 57)}…` : name}
        </div>

        {description ? (
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 30,
              color: ink,
              opacity: 0.72,
              maxWidth: "900px",
            }}
          >
            {description.length > 110 ? `${description.slice(0, 107)}…` : description}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 22,
            color: accent,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Made with ScrollCraft
        </div>
      </div>
    ),
    size
  );
}
