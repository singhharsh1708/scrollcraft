import { ImageResponse } from "next/og";
import { siteUrl } from "@/lib/env";

export const runtime = "edge";
export const alt = "ScrollCraft — Cinematic Scroll Sites";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 50%, #0a0a0f 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          {/* Drawn, not typed: the edge runtime's font has no U+2726, so the old ✦
              rendered as a tofu box on every share card. */}
          <svg width="40" height="40" viewBox="0 0 512 512">
            <path
              d="M256 106 L287.1 224.9 L406 256 L287.1 287.1 L256 406 L224.9 287.1 L106 256 L224.9 224.9 Z"
              fill="#ffffff"
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-2px",
            marginBottom: 16,
          }}
        >
          ScrollCraft
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.6)",
            marginBottom: 40,
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          Build cinematic scroll websites in minutes. No code.
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {["Procedural canvas backgrounds", "Scroll-linked animation", "Pure HTML export"].map((t) => (
            <div
              key={t}
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                border: "1px solid rgba(124,58,237,0.5)",
                background: "rgba(124,58,237,0.15)",
                color: "#a78bfa",
                fontSize: 18,
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            color: "rgba(255,255,255,0.3)",
            fontSize: 18,
          }}
        >
          {siteUrl.replace(/^https?:\/\//, "")}
        </div>
      </div>
    ),
    { ...size }
  );
}
