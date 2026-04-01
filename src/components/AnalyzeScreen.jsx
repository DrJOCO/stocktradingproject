import { useState, useEffect } from "react";
import { C, Card, Spinner } from "./ui.jsx";
import { fetchCandleData } from "../api/finnhub.js";
import { buildSignalCard } from "../indicators/scoring.js";

const POPULAR = [
  { label: "AAPL", type: "stock" }, { label: "NVDA", type: "stock" }, { label: "TSLA", type: "stock" },
  { label: "AMZN", type: "stock" }, { label: "MSFT", type: "stock" }, { label: "META", type: "stock" },
  { label: "SPY", type: "etf" }, { label: "QQQ", type: "etf" }, { label: "XLE", type: "etf" },
  { label: "BTC", type: "crypto" }, { label: "ETH", type: "crypto" }, { label: "SOL", type: "crypto" },
];

const STEPS = [
  "Connecting to market data", "Fetching candle data", "Calculating MAs + VWAP",
  "Computing RSI, MACD, Supertrend", "Scanning Ichimoku + Fib levels", "Building signal card",
];

export default function AnalyzeScreen({ onResult, onError }) {
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

  const analyze = async () => {
    if (!ticker.trim() || loading) return;
    setLoading(true); setStep(0);
    try {
      // imports are at top of file

      for (let i = 0; i < 4; i++) { setStep(i); await new Promise(r => setTimeout(r, 250)); }
      const raw = await fetchCandleData(ticker.trim(), tf, assetType);
      setStep(4);
      const signal = buildSignalCard(ticker.trim(), tf, raw);
      setStep(5);
      await new Promise(r => setTimeout(r, 150));
      onResult(signal, signal.analysis, assetType);
    } catch (e) {
      onError(e.message || "Failed to fetch data.");
    } finally {
      setLoading(false); setStep(0); setDots("");
    }
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
            <button onClick={() => setTicker("")} style={{ background: "transparent", border: "none", color: C.dim, fontSize: "0.9rem", padding: "4px 6px" }}>x</button>
          )}
        </div>

        {/* Selectors */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {[
            { label: "ASSET TYPE", val: assetType, set: setAssetType, opts: ["US Stock", "Crypto", "ETF"] },
            { label: "TIMEFRAME", val: tf, set: setTf, opts: ["1m","5m","15m","30m","1H","4H","1D","1W"] },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: C.dim, fontSize: "0.57rem", letterSpacing: "0.1em", fontFamily: C.mono }}>{s.label}</label>
              <select value={s.val} onChange={e => s.set(e.target.value)} disabled={loading}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.75rem" }}>
                {s.opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Analyze button */}
        <button onClick={analyze} disabled={loading || !ticker.trim()} style={{
          background: loading || !ticker.trim() ? "#0a120a" : "linear-gradient(135deg,#0d2e18,#0f3820)",
          border: `1px solid ${loading || !ticker.trim() ? C.border : C.green}`,
          color: loading || !ticker.trim() ? C.dim : C.green,
          borderRadius: 8, padding: "14px 0", fontSize: "0.8rem", letterSpacing: "0.15em", fontWeight: 700, width: "100%",
        }}>
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
                <span style={{ color: C.green }}>17+ INDICATORS</span> - Supertrend, VWAP, Ichimoku, Stoch RSI, Williams %R, A/D Line, Fibonacci, Pivot Points, MACD, RSI, BB%, OBV, ADX/DMI, RSI divergence, TTM Squeeze, CMF, Heikin Ashi. Live data via Yahoo Finance.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
