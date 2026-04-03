import { useState, useEffect } from "react";
import { C, Card, Spinner, Chip, UI, selectStyle, primaryButtonStyle, iconButtonStyle } from "./ui.jsx";
import { fetchCandleData } from "../api/finnhub.js";
import { buildSignalCard } from "../indicators/scoring.js";

const POPULAR = [
  { label: "AAPL", type: "stock" }, { label: "NVDA", type: "stock" }, { label: "TSLA", type: "stock" },
  { label: "AMZN", type: "stock" }, { label: "MSFT", type: "stock" }, { label: "META", type: "stock" },
  { label: "SPY", type: "etf" }, { label: "QQQ", type: "etf" }, { label: "XLE", type: "etf" },
  { label: "BTC", type: "crypto" }, { label: "ETH", type: "crypto" }, { label: "SOL", type: "crypto" },
];

const STEPS = [
  "Connecting to market data", "Fetching candle data", "Calculating MAs + rVWAP",
  "Computing RSI, MACD, Supertrend", "Scanning Ichimoku + Fib levels", "Building signal card",
];

export default function AnalyzeScreen({ onResult, onError, recentAnalyses = [] }) {
  const [ticker, setTicker] = useState("");
  const [tf, setTf] = useState("1D");
  const [assetType, setAssetType] = useState("US Stock");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 380);
    return () => clearInterval(id);
  }, [loading]);

  const runAnalysis = async (symbol = ticker.trim(), timeframe = tf, asset = assetType) => {
    if (!symbol.trim() || loading) return;
    const normalizedTicker = symbol.trim().toUpperCase();
    setLoading(true); setStep(0);
    setTicker(normalizedTicker);
    setTf(timeframe);
    setAssetType(asset);
    try {
      // imports are at top of file

      for (let i = 0; i < 4; i++) { setStep(i); await new Promise(r => setTimeout(r, 250)); }
      const raw = await fetchCandleData(normalizedTicker, timeframe, asset);
      setStep(4);
      const signal = buildSignalCard(normalizedTicker, timeframe, raw);
      setStep(5);
      await new Promise(r => setTimeout(r, 150));
      onResult(signal, signal.analysis, asset, raw);
    } catch (e) {
      onError(e.message || "Failed to fetch data.");
    } finally {
      setLoading(false); setStep(0); setDots("");
    }
  };

  const analyze = async () => {
    await runAnalysis(ticker.trim(), tf, assetType);
  };

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: "85vh", justifyContent: "center", padding: "20px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ fontFamily: C.raj, fontSize: "2.2rem", fontWeight: 700, color: C.green, letterSpacing: "0.1em", lineHeight: 1 }}>SIGNAL ANALYZER</div>
        <div style={{ color: C.dim, fontSize: "0.6rem", letterSpacing: "0.2em", marginTop: 4, fontFamily: C.mono }}>LIVE DATA · 17+ INDICATORS</div>
      </div>

      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Ticker input */}
        <div style={{
          background: C.card, border: `1px solid ${loading ? C.green : C.border}`, borderRadius: 10,
          padding: "4px 6px 4px 14px", display: "flex", alignItems: "center", gap: 8, transition: "border-color 0.2s",
        }}>
          <span style={{ color: C.green, fontSize: "1.1rem", fontFamily: C.mono, fontWeight: 800 }}>$</span>
          <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && analyze()} placeholder="ENTER TICKER" maxLength={12} disabled={loading}
            style={{ flex: 1, background: "transparent", border: "none", color: C.light, fontFamily: C.raj, fontSize: "1.4rem", fontWeight: 700, letterSpacing: "0.08em" }} />
          {ticker && !loading && (
            <button onClick={() => setTicker("")} style={iconButtonStyle()}>x</button>
          )}
        </div>

        {/* Selectors */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {[
            { label: "ASSET TYPE", val: assetType, set: setAssetType, opts: ["US Stock", "Crypto", "ETF"] },
            { label: "TIMEFRAME", val: tf, set: setTf, opts: ["1m","5m","15m","30m","1H","4H","1D","1W"] },
          ].map(s => (
            <div key={s.label} style={UI.field}>
              <label style={UI.label}>{s.label}</label>
              <select value={s.val} onChange={e => s.set(e.target.value)} disabled={loading}
                style={selectStyle({ background: C.card })}>
                {s.opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Analyze button */}
        <button onClick={analyze} disabled={loading || !ticker.trim()} style={primaryButtonStyle(!loading && !!ticker.trim(), { padding: "14px 0", fontSize: "0.8rem" })}>
          {loading
            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <Spinner />{STEPS[step]}{dots}
              </span>
            : "ANALYZE SIGNAL"
          }
        </button>

        {/* Step dots */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {STEPS.map((_, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= step ? C.green : C.border, transition: "background 0.3s" }} />)}
          </div>
        )}

        {/* Popular tickers + info */}
        {!loading && (
          <>
            <div>
              <div style={{ color: C.dim, fontSize: "0.56rem", letterSpacing: "0.12em", marginBottom: 8, fontFamily: C.mono }}>POPULAR</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {POPULAR.map(p => (
                  <button key={p.label} onClick={() => {
                    setTicker(p.label);
                    if (p.type === "crypto") setAssetType("Crypto");
                    else if (p.type === "etf") setAssetType("ETF");
                    else setAssetType("US Stock");
                  }} style={{
                    background: ticker === p.label ? "#0d2a18" : C.card,
                    border: `1px solid ${ticker === p.label ? C.green : C.border}`,
                    color: ticker === p.label ? C.green : C.mid,
                    borderRadius: 5, padding: "4px 12px", fontSize: "0.65rem", letterSpacing: "0.07em", fontFamily: C.mono,
                  }}>
                    {p.label}<span style={{ color: C.dim, fontSize: "0.5rem", marginLeft: 4 }}>{p.type}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: "#0c0f0a", border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 12px" }}>
              <p style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono, lineHeight: 1.65 }}>
                <span style={{ color: C.green }}>17+ INDICATORS</span> - Supertrend, rolling VWAP, Ichimoku, Stoch RSI, Williams %R, A/D Line, Fibonacci, Pivot Points, MACD, RSI, BB%, OBV, ADX/DMI, RSI divergence, TTM Squeeze, CMF, Heikin Ashi. Live data via Yahoo Finance.
              </p>
            </div>

            {recentAnalyses.length > 0 && (
              <Card style={{ padding: 12, marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
                  <div style={{ color: C.dim, fontSize: "0.56rem", letterSpacing: "0.12em", fontFamily: C.mono }}>RECENT ANALYSIS</div>
                  <span style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono }}>tap to rerun</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {recentAnalyses.slice(0, 6).map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => runAnalysis(entry.ticker, entry.timeframe, entry.assetType)}
                      style={{
                        background: "#081008",
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: "10px 11px",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                          <span style={{ color: C.light, fontFamily: C.raj, fontSize: "0.92rem", fontWeight: 700 }}>{entry.ticker}</span>
                          <span style={{ color: C.dim, fontSize: "0.53rem", fontFamily: C.mono }}>{entry.timeframe} · {entry.assetType}</span>
                        </div>
                        <div style={{ color: C.mid, fontSize: "0.56rem", fontFamily: C.mono, lineHeight: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                          {entry.heroLead || entry.keyStrength || entry.summary || "Recent analysis snapshot"}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <Chip label={entry.signal} color={entry.signal?.includes("LONG") ? C.green : entry.signal?.includes("SHORT") ? C.red : C.yellow} />
                        <span style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono }}>S{entry.score} · {entry.confidence}%</span>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
