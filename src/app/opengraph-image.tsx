import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ScrollCraft — AI Scroll Sites";
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
            fontSize: 36,
          }}
        >
          ✦
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
          {["AI-generated frames", "Scroll-linked animation", "Pure HTML export"].map((t) => (
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
          scrollcraft-gilt.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
