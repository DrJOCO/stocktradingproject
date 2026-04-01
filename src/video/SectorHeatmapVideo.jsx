import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

const C = {
  bg: "#070d07", card: "#0b120b", border: "#182818",
  green: "#22c55e", red: "#ef4444", yellow: "#eab308",
  orange: "#f97316", cyan: "#06b6d4", dim: "#3d5c3d", mid: "#6a9a6a", light: "#c8ecc8",
};

const getColor = (score) => {
  if (score >= 70) return C.green;
  if (score >= 58) return "#4ade80";
  if (score >= 43) return C.yellow;
  if (score >= 30) return C.orange;
  return C.red;
};

export const SectorHeatmapVideo = ({ sectors = [], scanTime = "" }) => {
  const frame = useCurrentFrame();
  const font = "'JetBrains Mono', monospace";
  const fontD = "'Rajdhani', sans-serif";

  const titleFade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  // Sort by score
  const sorted = [...sectors].sort((a, b) => b.score - a.score);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, padding: 40, fontFamily: font }}>
      {/* Header */}
      <div style={{ opacity: titleFade, marginBottom: 30 }}>
        <div style={{ color: C.dim, fontSize: 12, letterSpacing: 3, marginBottom: 4 }}>S&P 500</div>
        <div style={{ fontFamily: fontD, fontSize: 48, fontWeight: 700, color: C.green, letterSpacing: 2, lineHeight: 1 }}>SECTOR HEATMAP</div>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>{scanTime}</div>
        <div style={{ height: 2, background: `linear-gradient(to right, ${C.green}, transparent)`, marginTop: 12 }} />
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {sorted.map((s, i) => {
          const delay = 10 + i * 5;
          const fade = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
          const scale = interpolate(frame, [delay, delay + 15], [0.8, 1], { extrapolateRight: "clamp" });
          const scoreAnim = interpolate(frame, [delay + 5, delay + 30], [0, s.score], { extrapolateRight: "clamp" });
          const color = getColor(s.score);
          const changePct = Number(s.change || 0);

          return (
            <div key={s.etf} style={{
              opacity: fade, transform: `scale(${scale})`,
              background: color + "12", border: `2px solid ${color}40`, borderRadius: 12,
              padding: "18px 14px", textAlign: "center",
            }}>
              <div style={{ color: C.light, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
              <div style={{ color, fontSize: 42, fontWeight: 800, lineHeight: 1 }}>{Math.round(scoreAnim)}</div>
              <div style={{ color: changePct >= 0 ? C.green : C.red, fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                {changePct >= 0 ? "+" : ""}{s.change}%
              </div>
              <div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{s.etf}</div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 30, left: 40, display: "flex", gap: 16, opacity: interpolate(frame, [60, 75], [0, 1], { extrapolateRight: "clamp" }) }}>
        {[
          { label: "STRONG", color: C.green },
          { label: "BULLISH", color: "#4ade80" },
          { label: "NEUTRAL", color: C.yellow },
          { label: "WEAK", color: C.orange },
          { label: "BEARISH", color: C.red },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
            <span style={{ color: C.dim, fontSize: 10 }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Watermark */}
      <div style={{ position: "absolute", bottom: 30, right: 40, opacity: 0.3 }}>
        <span style={{ color: C.green, fontSize: 14, letterSpacing: 3, fontWeight: 700 }}>SIGNAL ANALYZER</span>
      </div>
    </AbsoluteFill>
  );
};
