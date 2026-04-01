import { lazy, Suspense, useState } from "react";
import { C, Card, SecHead, Spinner, Chip } from "./ui.jsx";
import { buildHeatmapVideoProps } from "./videoExportProps.js";
import { fetchCandleData } from "../api/finnhub.js";
import { buildSignalCard, SIGNALS } from "../indicators/scoring.js";

const VideoExportButton = lazy(() =>
  import("./VideoExport.jsx").then((module) => ({ default: module.VideoExportButton }))
);

const SECTORS = [
  { etf: "XLK", name: "Tech" },
  { etf: "XLF", name: "Finance" },
  { etf: "XLE", name: "Energy" },
  { etf: "XLV", name: "Health" },
  { etf: "XLI", name: "Industry" },
  { etf: "XLC", name: "Comms" },
  { etf: "XLY", name: "Consumer" },
  { etf: "XLP", name: "Staples" },
  { etf: "XLU", name: "Utilities" },
  { etf: "XLRE", name: "RealEst" },
  { etf: "XLB", name: "Material" },
];

export default function SectorHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanTime, setScanTime] = useState(null);

  const scan = async () => {
    setLoading(true); setProgress(0);
    const results = [];
    for (let i = 0; i < SECTORS.length; i++) {
      try {
        const raw = await fetchCandleData(SECTORS[i].etf, "1D", "ETF");
        const card = buildSignalCard(SECTORS[i].etf, "1D", raw);
        results.push({ ...SECTORS[i], signal: card.signal, score: card.score, rsi: card.rsi, change: ((card.entry - raw.closes[raw.closes.length - 2]) / raw.closes[raw.closes.length - 2] * 100).toFixed(1) });
      } catch {
        results.push({ ...SECTORS[i], signal: "NEUTRAL", score: 50, rsi: 50, change: "0.0" });
      }
      setProgress(i + 1);
      if (i < SECTORS.length - 1) await new Promise(r => setTimeout(r, 200));
    }
    setData(results);
    setScanTime(new Date());
    setLoading(false);
  };

  const getColor = (score) => {
    if (score >= 70) return C.green;
    if (score >= 58) return "#4ade80";
    if (score >= 43) return C.yellow;
    if (score >= 30) return C.orange;
    return C.red;
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SecHead left="SECTOR HEATMAP" right="S&P 500 SECTORS" />
        <button onClick={scan} disabled={loading} style={{
          background: loading ? "transparent" : "#0d2a18", border: `1px solid ${loading ? C.border : C.green}`,
          color: loading ? C.dim : C.green, borderRadius: 5, padding: "4px 12px", fontSize: "0.58rem", fontFamily: C.mono, fontWeight: 700,
        }}>
          {loading ? <><Spinner size={10} /> {progress}/{SECTORS.length}</> : data ? "REFRESH" : "SCAN"}
        </button>
        {data && scanTime && (
          <Suspense fallback={<Chip label="LOADING VIDEO" color={C.dim} bg="#101610" bd={C.border} />}>
            <VideoExportButton type="heatmap" props={buildHeatmapVideoProps(data, scanTime)} label="VIDEO" />
          </Suspense>
        )}
      </div>

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", gap: 6 }}>
          {data.sort((a, b) => b.score - a.score).map(s => {
            const color = getColor(s.score);
            const changePct = Number(s.change);
            return (
              <div key={s.etf} style={{
                background: color + "0a", border: `1px solid ${color}30`, borderRadius: 6,
                padding: "8px 6px", textAlign: "center",
              }}>
                <div style={{ color: C.light, fontSize: "0.65rem", fontWeight: 700, fontFamily: C.mono, marginBottom: 2 }}>{s.name}</div>
                <div style={{ color, fontSize: "0.85rem", fontWeight: 800, fontFamily: C.mono }}>{s.score}</div>
                <div style={{ color: changePct >= 0 ? C.green : C.red, fontSize: "0.55rem", fontFamily: C.mono }}>{changePct >= 0 ? "+" : ""}{s.change}%</div>
                <div style={{ color: C.dim, fontSize: "0.48rem", fontFamily: C.mono, marginTop: 2 }}>{s.etf}</div>
              </div>
            );
          })}
        </div>
      )}

      {!data && !loading && (
        <p style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono, textAlign: "center", padding: "12px 0" }}>
          Click SCAN to check all 11 S&P sectors
        </p>
      )}
    </Card>
  );
}
