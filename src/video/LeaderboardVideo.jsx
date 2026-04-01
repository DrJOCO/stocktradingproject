import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";

const C = {
  bg: "#070d07", card: "#0b120b", border: "#182818",
  green: "#22c55e", red: "#ef4444", yellow: "#eab308",
  purple: "#a855f7", cyan: "#06b6d4", dim: "#3d5c3d", mid: "#6a9a6a", light: "#c8ecc8",
};

const SIGNAL_COLORS = {
  "STRONG LONG": C.green, "LONG BIAS": C.green, "NEUTRAL": C.yellow,
  "SHORT BIAS": C.purple, "STRONG SHORT": C.red,
};

export const LeaderboardVideo = ({ results = [], scanTime = "", title = "TOP SIGNALS" }) => {
  const frame = useCurrentFrame();
  const font = "'JetBrains Mono', monospace";
  const fontD = "'Rajdhani', sans-serif";

  const titleFade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const titleSlide = interpolate(frame, [0, 20], [-20, 0], { extrapolateRight: "clamp" });

  // Show top 10
  const top = results.slice(0, 10);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, padding: 40, fontFamily: font }}>
      {/* Header */}
      <div style={{ opacity: titleFade, transform: `translateY(${titleSlide}px)`, marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ color: C.dim, fontSize: 12, letterSpacing: 3, marginBottom: 4 }}>SCAN RESULTS</div>
            <div style={{ fontFamily: fontD, fontSize: 48, fontWeight: 700, color: C.green, letterSpacing: 2, lineHeight: 1 }}>{title}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.dim, fontSize: 12 }}>{scanTime}</div>
            <div style={{ color: C.mid, fontSize: 14 }}>{results.length} stocks scanned</div>
          </div>
        </div>
        <div style={{ height: 2, background: `linear-gradient(to right, ${C.green}, transparent)`, marginTop: 12 }} />
      </div>

      {/* Leaderboard rows */}
      {top.map((r, i) => {
        const delay = 12 + i * 6;
        const rowFade = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
        const rowSlide = interpolate(frame, [delay, delay + 15], [20, 0], { extrapolateRight: "clamp" });
        const scoreBar = interpolate(frame, [delay + 5, delay + 30], [0, r.score || 0], { extrapolateRight: "clamp" });
        const sc = SIGNAL_COLORS[r.signal] || C.yellow;

        return (
          <div key={r.ticker} style={{
            opacity: rowFade, transform: `translateY(${rowSlide}px)`,
            display: "flex", alignItems: "center", gap: 14,
            background: i === 0 ? "#0d1a0d" : "#090f09",
            border: `1px solid ${i === 0 ? C.green + "40" : C.border}`,
            borderRadius: 10, padding: "12px 16px", marginBottom: 8,
          }}>
            {/* Rank */}
            <span style={{ color: i < 3 ? C.green : C.dim, fontSize: 20, fontWeight: 800, minWidth: 32 }}>
              #{i + 1}
            </span>
            {/* Ticker */}
            <span style={{ color: C.light, fontFamily: fontD, fontSize: 26, fontWeight: 700, minWidth: 80 }}>
              {r.ticker}
            </span>
            {/* Signal chip */}
            <span style={{
              background: sc + "1a", border: `1px solid ${sc}40`, color: sc,
              fontSize: 11, padding: "3px 10px", borderRadius: 4, fontWeight: 700, minWidth: 90, textAlign: "center",
            }}>{r.signal}</span>
            {/* Score bar */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, background: "#0d1a0d", borderRadius: 3, height: 8, overflow: "hidden" }}>
                <div style={{ background: sc, width: `${scoreBar}%`, height: "100%", borderRadius: 3 }} />
              </div>
              <span style={{ color: sc, fontSize: 18, fontWeight: 800, minWidth: 30 }}>{r.score}</span>
            </div>
            {/* Price */}
            <span style={{ color: C.mid, fontSize: 14, minWidth: 70, textAlign: "right" }}>${r.entry}</span>
          </div>
        );
      })}

      {/* Watermark */}
      <div style={{ position: "absolute", bottom: 30, right: 40, opacity: 0.3 }}>
        <span style={{ color: C.green, fontSize: 14, letterSpacing: 3, fontWeight: 700 }}>SIGNAL ANALYZER</span>
      </div>
    </AbsoluteFill>
  );
};
