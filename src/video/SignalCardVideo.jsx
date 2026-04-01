import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";

const C = {
  bg: "#070d07", card: "#0b120b", border: "#182818",
  green: "#22c55e", red: "#ef4444", yellow: "#eab308",
  purple: "#a855f7", cyan: "#06b6d4", orange: "#f97316",
  dim: "#3d5c3d", mid: "#6a9a6a", light: "#c8ecc8",
};

const SIGNAL_COLORS = {
  "STRONG LONG": C.green, "LONG BIAS": C.green, "NEUTRAL": C.yellow,
  "SHORT BIAS": C.purple, "STRONG SHORT": C.red,
};

export const SignalCardVideo = ({ ticker, signal, confidence, score, entry, stop, target,
  stopPct, tgtPct, rsi, macdDir, adx, vol, atrPct, aboveVWAP, supertrend,
  commentary, indicators = [] }) => {

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const signalColor = SIGNAL_COLORS[signal] || C.yellow;

  // Animations
  const fadeIn = (delay = 0) => interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });
  const slideUp = (delay = 0) => interpolate(frame, [delay, delay + 20], [30, 0], { extrapolateRight: "clamp" });
  const scoreAnim = interpolate(frame, [15, 50], [0, score], { extrapolateRight: "clamp" });
  const confAnim = interpolate(frame, [20, 55], [0, confidence], { extrapolateRight: "clamp" });
  const barWidth = interpolate(frame, [25, 60], [0, confidence], { extrapolateRight: "clamp" });

  const font = "'JetBrains Mono', 'SF Mono', monospace";
  const fontD = "'Rajdhani', 'Arial', sans-serif";

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, padding: 40, fontFamily: font, justifyContent: "center" }}>
      {/* Header */}
      <div style={{ opacity: fadeIn(0), transform: `translateY(${slideUp(0)}px)`, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ color: C.dim, fontSize: 14, letterSpacing: 3, marginBottom: 4 }}>ACTION SIGNAL</div>
            <div style={{ fontFamily: fontD, fontSize: 64, fontWeight: 700, color: signalColor, letterSpacing: 2, lineHeight: 1 }}>{signal}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.dim, fontSize: 14, letterSpacing: 2, marginBottom: 4 }}>{ticker}</div>
            <div style={{ fontFamily: fontD, fontSize: 72, fontWeight: 700, color: signalColor, lineHeight: 1 }}>
              {Math.round(confAnim)}%
            </div>
            <div style={{ color: C.dim, fontSize: 12 }}>confidence</div>
          </div>
        </div>
        {/* Confidence bar */}
        <div style={{ background: "#0d1a0d", borderRadius: 3, height: 6, marginTop: 16, overflow: "hidden" }}>
          <div style={{ background: signalColor, width: `${barWidth}%`, height: "100%", borderRadius: 3 }} />
        </div>
      </div>

      {/* Commentary */}
      {commentary && (
        <div style={{ opacity: fadeIn(10), transform: `translateY(${slideUp(10)}px)`,
          background: signalColor + "10", border: `1px solid ${signalColor}30`, borderRadius: 10,
          padding: "12px 18px", marginBottom: 20 }}>
          <p style={{ color: C.light, fontSize: 16, lineHeight: 1.6, margin: 0 }}>{commentary}</p>
        </div>
      )}

      {/* Entry / Stop / Target */}
      <div style={{ opacity: fadeIn(18), transform: `translateY(${slideUp(18)}px)`,
        display: "flex", gap: 16, marginBottom: 20 }}>
        {[
          { l: "ENTRY", v: `$${entry}`, sub: "market", c: C.light },
          { l: "STOP", v: `$${stop}`, sub: `${stopPct}%`, c: C.red },
          { l: "TARGET", v: `$${target}`, sub: `${tgtPct}%`, c: C.green },
        ].map(b => (
          <div key={b.l} style={{ flex: 1, background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ color: C.dim, fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>{b.l}</div>
            <div style={{ color: b.c, fontSize: 28, fontWeight: 800 }}>{b.v}</div>
            <div style={{ color: C.dim, fontSize: 12 }}>{b.sub}</div>
          </div>
        ))}
      </div>

      {/* Score + metrics row */}
      <div style={{ opacity: fadeIn(28), transform: `translateY(${slideUp(28)}px)`,
        display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { l: "SCORE", v: Math.round(scoreAnim), c: score >= 70 ? C.green : score >= 50 ? C.yellow : C.red },
          { l: "RSI", v: rsi, c: rsi > 70 ? C.red : rsi < 30 ? C.green : C.light },
          { l: "ADX", v: adx, c: adx > 25 ? C.green : C.dim },
          { l: "MACD", v: macdDir, c: macdDir === "Bull" ? C.green : C.red },
          { l: "VOL", v: `${vol}x`, c: vol > 1.5 ? C.green : vol < 0.5 ? C.red : C.mid },
          { l: "VWAP", v: aboveVWAP ? "ABOVE" : "BELOW", c: aboveVWAP ? C.green : C.red },
        ].map(m => (
          <div key={m.l} style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", textAlign: "center", minWidth: 80 }}>
            <div style={{ color: C.dim, fontSize: 10, letterSpacing: 2, marginBottom: 3 }}>{m.l}</div>
            <div style={{ color: m.c, fontSize: 22, fontWeight: 800 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Indicator checklist (first 6) */}
      <div style={{ opacity: fadeIn(38), transform: `translateY(${slideUp(38)}px)` }}>
        {indicators.slice(0, 6).map((ind, i) => {
          const ic = ind.status === "warn" ? C.yellow : ind.status === "fail" ? C.red : C.green;
          const indFade = fadeIn(38 + i * 3);
          return (
            <div key={i} style={{ opacity: indFade, display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 16, color: ic, minWidth: 18 }}>
                {ind.status === "warn" ? "!" : ind.status === "fail" ? "✗" : "✓"}
              </span>
              <span style={{ color: ic === C.green ? C.mid : ic, fontSize: 14 }}>{ind.label}</span>
            </div>
          );
        })}
      </div>

      {/* Watermark */}
      <div style={{ position: "absolute", bottom: 30, right: 40, opacity: 0.3 }}>
        <span style={{ color: C.green, fontSize: 14, letterSpacing: 3, fontWeight: 700 }}>SIGNAL ANALYZER</span>
      </div>
    </AbsoluteFill>
  );
};
