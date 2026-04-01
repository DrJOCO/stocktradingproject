// Portfolio Optimizer — enter positions, get per-position signals + portfolio summary

import { useState } from "react";
import { C, Card, Chip, SecHead, Spinner } from "./ui.jsx";
import { fetchCandleData } from "../api/finnhub.js";
import { buildSignalCard, SIGNALS } from "../indicators/scoring.js";

export default function PortfolioScreen() {
  const [positions, setPositions] = useState([]);
  const [inputTicker, setInputTicker] = useState("");
  const [inputShares, setInputShares] = useState("");
  const [inputType, setInputType] = useState("SH");
  const [inputAsset, setInputAsset] = useState("US Stock");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const addPosition = () => {
    if (!inputTicker.trim() || !inputShares) return;
    setPositions(p => [...p, { ticker: inputTicker.toUpperCase(), shares: inputShares, posType: inputType, assetType: inputAsset }]);
    setInputTicker(""); setInputShares("");
  };

  const removePosition = i => setPositions(p => p.filter((_, j) => j !== i));

  const analyze = async () => {
    if (!positions.length) return;
    setLoading(true); setResults(null); setError(null);
    try {
      setStep("Fetching live data");
      const res = [];
      for (const pos of positions) {
        try {
          const raw = await fetchCandleData(pos.ticker, "1D", pos.assetType || "US Stock");
          const card = buildSignalCard(pos.ticker, "1D", raw);
          const shares = Number(pos.shares) || 0;
          res.push({ ...card, shares, value: shares * card.entry, posType: pos.posType || "SH" });
        } catch {
          res.push({ ticker: pos.ticker, signal: "NEUTRAL", confidence: 50, score: 50, entry: 0, rsi: 50, shares: Number(pos.shares) || 0, value: 0, posType: pos.posType || "SH", error: true });
        }
        await new Promise(r => setTimeout(r, 200));
      }

      setStep("Computing portfolio metrics");
      const totalValue = res.reduce((a, b) => a + (b.value || 0), 0);
      const bullPos = res.filter(r => r.signal?.includes("LONG"));
      const bearPos = res.filter(r => r.signal?.includes("SHORT"));
      const bullPct = totalValue > 0 ? Math.round(bullPos.reduce((a, b) => a + (b.value || 0), 0) / totalValue * 100) : 0;
      const bearPct = totalValue > 0 ? Math.round(bearPos.reduce((a, b) => a + (b.value || 0), 0) / totalValue * 100) : 0;
      const avgConf = Math.round(res.reduce((a, b) => a + (b.confidence || 50), 0) / res.length);
      const stopRisk = res.reduce((a, b) => {
        const w = totalValue > 0 ? (b.value || 0) / totalValue : 0;
        return a + (b.entry > 0 ? Math.abs((b.stop - b.entry) / b.entry * 100) * w : 0);
      }, 0);
      const bias = bullPct > 60 ? "BULLISH" : bearPct > 60 ? "BEARISH" : "MIXED";

      // Risk flags
      const riskFlags = [];
      const concentrated = res.filter(r => totalValue > 0 && r.value / totalValue > 0.3);
      if (concentrated.length) riskFlags.push(`${concentrated.map(r => r.ticker).join(", ")} is >30% of portfolio — concentration risk.`);
      const weakSignals = res.filter(r => r.signal === "SHORT BIAS" || r.signal === "STRONG SHORT");
      if (weakSignals.length) riskFlags.push(`${weakSignals.map(r => r.ticker).join(", ")} showing bearish signals — consider reducing.`);
      if (stopRisk > 5) riskFlags.push(`Weighted stop-loss risk at ${stopRisk.toFixed(1)}% — consider tighter stops.`);
      const lowVol = res.filter(r => r.vol && r.vol < 0.5);
      if (lowVol.length) riskFlags.push(`${lowVol.map(r => r.ticker).join(", ")} have thin volume — exits may slip.`);

      // Rebalance ideas
      const rebalanceIdeas = [];
      const strongLongs = res.filter(r => r.signal === "STRONG LONG");
      if (strongLongs.length) rebalanceIdeas.push(`Strong signals on ${strongLongs.map(r => r.ticker).join(", ")} — consider adding.`);
      if (bullPct > 80) rebalanceIdeas.push("Portfolio is >80% bull-biased. Consider hedging with puts or inverse ETFs.");
      if (bias === "MIXED") rebalanceIdeas.push("Mixed signals across positions. Let winners run, cut weak signals.");
      const neutrals = res.filter(r => r.signal === "NEUTRAL");
      if (neutrals.length > res.length / 2) rebalanceIdeas.push("Over half your positions are neutral. Capital may be idle — rotate into trending names.");

      setResults({ positions: res, summary: { totalValue, bullPct, bearPct, avgConf, stopRisk, bias }, riskFlags, rebalanceIdeas });
    } catch (e) { setError(e.message || "Analysis failed"); }
    finally { setLoading(false); setStep(""); }
  };

  const biasColor = results?.summary.bias === "BULLISH" ? C.green : results?.summary.bias === "BEARISH" ? C.red : C.yellow;

  return (
    <div className="fade">
      <Card>
        <SecHead left="PORTFOLIO OPTIMIZER" />
        <p style={{ color: C.dim, fontSize: "0.62rem", fontFamily: C.mono, lineHeight: 1.65, marginBottom: 14 }}>
          Enter your positions. The system scores each holding and gives portfolio-level risk + rebalance suggestions.
        </p>

        {/* Input row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ color: C.dim, fontSize: "0.55rem", letterSpacing: "0.1em", fontFamily: C.mono }}>SYMBOL</label>
            <input value={inputTicker} onChange={e => setInputTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && addPosition()} placeholder="AAPL"
              style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.8rem" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ color: C.dim, fontSize: "0.55rem", letterSpacing: "0.1em", fontFamily: C.mono }}>SHARES</label>
            <input value={inputShares} onChange={e => setInputShares(e.target.value)} type="number" placeholder="100"
              style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.8rem" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ color: C.dim, fontSize: "0.55rem", letterSpacing: "0.1em", fontFamily: C.mono }}>TYPE</label>
            <select value={inputType} onChange={e => setInputType(e.target.value)}
              style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.75rem" }}>
              <option value="SH">SH</option><option value="PUT">PUT</option><option value="CALL">CALL</option>
            </select>
          </div>
          <button onClick={addPosition} style={{ background: C.green, border: "none", borderRadius: 5, color: "#070d07", fontWeight: 800, fontSize: "1.1rem", padding: "7px 14px", alignSelf: "flex-end" }}>+</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <select value={inputAsset} onChange={e => setInputAsset(e.target.value)}
            style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "5px 10px", color: C.mid, fontFamily: C.mono, fontSize: "0.65rem" }}>
            <option>US Stock</option><option>ETF</option><option>Crypto</option>
          </select>
          <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono, marginLeft: 8 }}>asset type for next entry</span>
        </div>

        {/* Position list */}
        {positions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {positions.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ color: C.green, fontFamily: C.raj, fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.05em" }}>{p.ticker}</span>
                  <span style={{ color: C.mid, fontFamily: C.mono, fontSize: "0.65rem" }}>{p.shares} shares</span>
                  <Chip label={p.posType} color={C.cyan} bg="#051414" bd={C.cyan + "40"} />
                </div>
                <button onClick={() => removePosition(i)} style={{ background: "transparent", border: "none", color: C.dim, fontSize: "0.9rem" }}>x</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={analyze} disabled={loading || !positions.length} style={{
          width: "100%", background: loading || !positions.length ? "#0a120a" : "linear-gradient(135deg,#0d2e18,#0f3820)",
          border: `1px solid ${loading || !positions.length ? C.border : C.green}`,
          color: loading || !positions.length ? C.dim : C.green,
          borderRadius: 7, padding: "12px 0", fontSize: "0.75rem", letterSpacing: "0.15em", fontWeight: 700,
        }}>
          {loading
            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><Spinner />{step}</span>
            : "ANALYZE PORTFOLIO"
          }
        </button>
        {error && <p style={{ color: C.red, fontSize: "0.62rem", fontFamily: C.mono, marginTop: 10 }}>! {error}</p>}
      </Card>

      {/* Results */}
      {results && (
        <>
          <Card>
            <SecHead left="PORTFOLIO SUMMARY" />
            {[
              { l: "Total Value", v: `$${(results.summary.totalValue / 1000).toFixed(1)}K` },
              { l: "Portfolio Bias", v: results.summary.bias, c: biasColor },
              { l: "Bull / Bear Exposure", v: `${results.summary.bullPct}% / ${results.summary.bearPct}%` },
              { l: "Avg Confidence", v: `${results.summary.avgConf}%` },
              { l: "Weighted Stop Risk", v: `-${results.summary.stopRisk.toFixed(1)}%`, c: C.red },
            ].map(row => (
              <div key={row.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, paddingBottom: 6, marginBottom: 6 }}>
                <span style={{ color: C.dim, fontSize: "0.63rem", fontFamily: C.mono }}>{row.l}</span>
                <span style={{ color: row.c || C.light, fontSize: "0.63rem", fontFamily: C.mono, fontWeight: row.c ? 700 : 400 }}>{row.v}</span>
              </div>
            ))}
          </Card>

          <Card>
            <SecHead left="POSITION SIGNALS" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.positions.map((p, i) => {
                const pct = results.summary.totalValue > 0 ? Math.round(p.value / results.summary.totalValue * 100) : 0;
                const meta = SIGNALS[p.signal] || SIGNALS["NEUTRAL"];
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ color: C.light, fontFamily: C.raj, fontSize: "0.9rem", fontWeight: 700, minWidth: 52 }}>{p.ticker}</span>
                        <span style={{ color: C.mid, fontSize: "0.6rem", fontFamily: C.mono }}>{pct}%</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>RSI {p.rsi} S{p.score}</span>
                        <Chip label={p.signal || "N"} color={meta.color} bg={meta.color + "18"} bd={meta.color + "40"} />
                      </div>
                    </div>
                    <div style={{ background: "#090f09", borderRadius: 2, height: 6, overflow: "hidden" }}>
                      <div style={{ background: meta.bar, width: `${Math.min(pct * 3, 100)}%`, height: "100%", borderRadius: 2, transition: "width 0.6s ease" }} />
                    </div>
                    {p.error && <p style={{ color: C.red, fontSize: "0.55rem", fontFamily: C.mono, marginTop: 3 }}>Failed to fetch data</p>}
                  </div>
                );
              })}
            </div>
          </Card>

          {results.riskFlags?.length > 0 && (
            <Card style={{ border: `1px solid ${C.red}30` }}>
              <SecHead left="RISK FLAGS" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {results.riskFlags.map((f, i) => (
                  <div key={i} style={{ background: "#140909", border: `1px solid ${C.red}25`, borderRadius: 5, padding: "8px 12px" }}>
                    <span style={{ color: C.mid, fontSize: "0.62rem", fontFamily: C.mono, lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {results.rebalanceIdeas?.length > 0 && (
            <Card style={{ border: `1px solid ${C.yellow}30` }}>
              <SecHead left="REBALANCE IDEAS" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {results.rebalanceIdeas.map((idea, i) => (
                  <div key={i} style={{ background: "#141100", border: `1px solid ${C.yellow}25`, borderRadius: 5, padding: "8px 12px" }}>
                    <span style={{ color: C.mid, fontSize: "0.62rem", fontFamily: C.mono, lineHeight: 1.5 }}>{idea}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
