import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ScrollCraft is live on Product Hunt";
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
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,97,84,0.2) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
        {/* PH badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 24px",
            borderRadius: 999,
            background: "rgba(255,97,84,0.15)",
            border: "1px solid rgba(255,97,84,0.4)",
            color: "#ff6154",
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 32,
          }}
        >
          🚀 Live on Product Hunt
        </div>

        <div style={{ fontSize: 80, fontWeight: 900, color: "#fff", letterSpacing: "-2px", marginBottom: 16 }}>
          ScrollCraft
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)", marginBottom: 40, textAlign: "center", maxWidth: 700 }}>
          AI scroll websites. No code. Pure HTML export.
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 32px",
            borderRadius: 16,
            background: "rgba(124,58,237,0.2)",
            border: "1px solid rgba(124,58,237,0.4)",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 20 }}>Use code</span>
          <span style={{ color: "#a78bfa", fontSize: 28, fontWeight: 800, letterSpacing: "4px" }}>PHHUNT</span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 20 }}>for 30% off</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
