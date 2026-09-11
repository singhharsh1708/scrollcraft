import { ImageResponse } from "next/og";
import { siteUrl } from "@/lib/env";

export const runtime = "edge";
export const alt = "ScrollCraft — Cinematic scroll websites, exported as plain HTML";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#030710",
          padding: "64px 72px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -180,
            top: -160,
            width: 760,
            height: 760,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,109,221,0.45) 0%, rgba(3,7,16,0) 68%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Drawn, not typed: the edge runtime's font has no U+2726, so a typed ✦
              rendered as a tofu box on every share card. */}
          <svg width="34" height="34" viewBox="0 0 512 512">
            <path
              d="M256 106 L287.1 224.9 L406 256 L287.1 287.1 L256 406 L224.9 287.1 L106 256 L224.9 224.9 Z"
              fill="#7fc8ff"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 30, color: "#e5f4ff", letterSpacing: "-0.5px" }}>ScrollCraft</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 300, color: "#e5f4ff", letterSpacing: "-3px", lineHeight: 1.05 }}>
            Cinematic scroll websites
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 300, color: "#7fc8ff", letterSpacing: "-3px", lineHeight: 1.05 }}>
            exported as plain HTML
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(229,244,255,0.14)",
            paddingTop: 26,
            fontSize: 22,
            color: "#93a9c0",
          }}
        >
          <div style={{ display: "flex" }}>Templates · Editor · One-ZIP export · Open source</div>
          <div style={{ display: "flex", color: "#7fc8ff" }}>{siteUrl.replace(/^https?:\/\//, "")}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
