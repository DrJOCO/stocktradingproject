// Portfolio Optimizer — enter positions, get per-position signals + portfolio summary

import { useEffect, useRef, useState } from "react";
import { C, Card, Chip, SecHead, Spinner, UI, inputStyle, selectStyle, primaryButtonStyle, iconButtonStyle, accentButtonStyle } from "./ui.jsx";
import { fetchCandleData } from "../api/finnhub.js";
import { buildSignalCard, SIGNALS } from "../indicators/scoring.js";
import { clearPortfolioPositions, getPortfolioPositions, savePortfolioPositions, subscribeStorage } from "../utils/storage.js";

export default function PortfolioScreen() {
  const [positions, setPositions] = useState(() => getPortfolioPositions());
  const [inputTicker, setInputTicker] = useState("");
  const [inputShares, setInputShares] = useState("");
  const [inputCostBasis, setInputCostBasis] = useState("");
  const [inputType, setInputType] = useState("SH");
  const [inputAsset, setInputAsset] = useState("US Stock");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const lastPersisted = useRef(null);

  if (lastPersisted.current === null) {
    lastPersisted.current = JSON.stringify(positions);
  }

  useEffect(() => {
    const serialized = JSON.stringify(positions);
    if (serialized === lastPersisted.current) return;
    lastPersisted.current = serialized;
    savePortfolioPositions(positions);
    setResults(null);
  }, [positions]);

  useEffect(() => subscribeStorage(({ origin, keys }) => {
    if (origin === "local") return;
    if (!keys?.includes("portfolioPositions")) return;
    const next = getPortfolioPositions();
    lastPersisted.current = JSON.stringify(next);
    setPositions(next);
    setResults(null);
  }), []);

  const addPosition = () => {
    const ticker = inputTicker.trim().toUpperCase();
    const shares = Number(inputShares);
    if (!ticker || !Number.isFinite(shares) || shares <= 0) return;
    const costBasis = inputCostBasis === "" ? null : Number(inputCostBasis);
    setPositions(p => [...p, {
      ticker,
      shares,
      costBasis: Number.isFinite(costBasis) && costBasis > 0 ? costBasis : null,
      posType: inputType,
      assetType: inputAsset,
    }]);
    setInputTicker("");
    setInputShares("");
    setInputCostBasis("");
  };

  const removePosition = i => setPositions(p => p.filter((_, j) => j !== i));
  const clearPositions = () => {
    clearPortfolioPositions();
    setPositions([]);
    setResults(null);
  };

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
          const costBasis = Number(pos.costBasis);
          const hasCostBasis = Number.isFinite(costBasis) && costBasis > 0;
          const value = shares * card.entry;
          const costValue = hasCostBasis ? shares * costBasis : null;
          const unrealizedPnl = hasCostBasis ? value - costValue : null;
          const unrealizedPct = hasCostBasis ? ((card.entry - costBasis) / costBasis) * 100 : null;
          res.push({
            ...card,
            shares,
            costBasis: hasCostBasis ? costBasis : null,
            value,
            costValue,
            unrealizedPnl,
            unrealizedPct,
            posType: pos.posType || "SH",
          });
        } catch {
          const shares = Number(pos.shares) || 0;
          const costBasis = Number(pos.costBasis);
          const hasCostBasis = Number.isFinite(costBasis) && costBasis > 0;
          res.push({
            ticker: pos.ticker,
            signal: "NEUTRAL",
            confidence: 50,
            score: 50,
            entry: 0,
            rsi: 50,
            shares,
            costBasis: hasCostBasis ? costBasis : null,
            value: 0,
            costValue: hasCostBasis ? shares * costBasis : null,
            unrealizedPnl: null,
            unrealizedPct: null,
            posType: pos.posType || "SH",
            error: true,
          });
        }
        await new Promise(r => setTimeout(r, 200));
      }

      setStep("Computing portfolio metrics");
      const totalValue = res.reduce((a, b) => a + (b.value || 0), 0);
      const tracked = res.filter(r => r.costValue != null);
      const totalCostBasis = tracked.reduce((a, b) => a + (b.costValue || 0), 0);
      const unrealizedPnl = tracked.reduce((a, b) => a + (b.unrealizedPnl || 0), 0);
      const unrealizedPct = totalCostBasis > 0 ? (unrealizedPnl / totalCostBasis) * 100 : null;
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
      if (tracked.length < res.length) riskFlags.push(`Add cost basis for ${res.length - tracked.length} position${res.length - tracked.length === 1 ? "" : "s"} to unlock full unrealized P&L.`);
      const underwaterBearish = tracked.filter(r => (r.unrealizedPct ?? 0) < -8 && (r.signal === "SHORT BIAS" || r.signal === "STRONG SHORT"));
      if (underwaterBearish.length) riskFlags.push(`${underwaterBearish.map(r => r.ticker).join(", ")} are underwater with bearish signals — review whether they still deserve capital.`);

      // Rebalance ideas
      const rebalanceIdeas = [];
      const strongLongs = res.filter(r => r.signal === "STRONG LONG");
      if (strongLongs.length) rebalanceIdeas.push(`Strong signals on ${strongLongs.map(r => r.ticker).join(", ")} — consider adding.`);
      if (bullPct > 80) rebalanceIdeas.push("Portfolio is >80% bull-biased. Consider hedging with puts or inverse ETFs.");
      if (bias === "MIXED") rebalanceIdeas.push("Mixed signals across positions. Let winners run, cut weak signals.");
      const neutrals = res.filter(r => r.signal === "NEUTRAL");
      if (neutrals.length > res.length / 2) rebalanceIdeas.push("Over half your positions are neutral. Capital may be idle — rotate into trending names.");
      const strongProfits = tracked.filter(r => (r.unrealizedPct ?? 0) > 12 && (r.signal === "SHORT BIAS" || r.signal === "STRONG SHORT"));
      if (strongProfits.length) rebalanceIdeas.push(`${strongProfits.map(r => r.ticker).join(", ")} are profitable but now carry bearish signals — consider trimming or tightening stops.`);

      setResults({
        positions: res,
        summary: { totalValue, totalCostBasis, unrealizedPnl, unrealizedPct, trackedCount: tracked.length, bullPct, bearPct, avgConf, stopRisk, bias },
        riskFlags,
        rebalanceIdeas,
      });
    } catch (e) { setError(e.message || "Analysis failed"); }
    finally { setLoading(false); setStep(""); }
  };

  const biasColor = results?.summary.bias === "BULLISH" ? C.green : results?.summary.bias === "BEARISH" ? C.red : C.yellow;

  return (
    <div className="fade">
      <Card>
        <SecHead left="PORTFOLIO OPTIMIZER" right={positions.length ? `${positions.length} SAVED` : "LOCAL / CLOUD SYNC"} />
        <p style={{ color: C.dim, fontSize: "0.62rem", fontFamily: C.mono, lineHeight: 1.65, marginBottom: 14 }}>
          Enter your positions once and they persist with the rest of your app state. The system scores each holding and gives portfolio-level risk plus rebalance suggestions.
        </p>
        <p style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, lineHeight: 1.55, marginBottom: 14 }}>
          Cost basis is per share or tracked unit. Leave it blank if you only want signal analysis and not unrealized P&amp;L.
        </p>

        {/* Input row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10, alignItems: "end" }}>
          <div style={UI.field}>
            <label style={UI.label}>SYMBOL</label>
            <input value={inputTicker} onChange={e => setInputTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && addPosition()} placeholder="AAPL"
              style={inputStyle({ fontSize: "0.8rem" })} />
          </div>
          <div style={UI.field}>
            <label style={UI.label}>QUANTITY</label>
            <input value={inputShares} onChange={e => setInputShares(e.target.value)} type="number" placeholder="100"
              style={inputStyle({ fontSize: "0.8rem" })} />
          </div>
          <div style={UI.field}>
            <label style={UI.label}>COST BASIS</label>
            <input value={inputCostBasis} onChange={e => setInputCostBasis(e.target.value)} type="number" placeholder="145.50"
              style={inputStyle({ fontSize: "0.8rem" })} />
          </div>
          <div style={UI.field}>
            <label style={UI.label}>TYPE</label>
            <select value={inputType} onChange={e => setInputType(e.target.value)}
              style={selectStyle()}>
              <option value="SH">SH</option><option value="PUT">PUT</option><option value="CALL">CALL</option>
            </select>
          </div>
          <button onClick={addPosition} style={accentButtonStyle(C.green, { alignSelf: "flex-end" })}>+</button>
        </div>

        <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select value={inputAsset} onChange={e => setInputAsset(e.target.value)}
            style={selectStyle({ color: C.mid, fontSize: "0.65rem", padding: "5px 10px", width: "fit-content" })}>
            <option>US Stock</option><option>ETF</option><option>Crypto</option>
          </select>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>asset type for next entry</span>
            {positions.length > 0 && (
              <button onClick={clearPositions} style={iconButtonStyle({ color: C.red, fontSize: "0.62rem", letterSpacing: "0.08em" })}>
                CLEAR SAVED POSITIONS
              </button>
            )}
          </div>
        </div>

        {/* Position list */}
        {positions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {positions.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ color: C.green, fontFamily: C.raj, fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.05em" }}>{p.ticker}</span>
                  <span style={{ color: C.mid, fontFamily: C.mono, fontSize: "0.65rem" }}>{p.shares} {p.posType === "SH" ? "shares" : "contracts"}</span>
                  <span style={{ color: C.dim, fontFamily: C.mono, fontSize: "0.6rem" }}>{p.costBasis ? `CB $${Number(p.costBasis).toFixed(2)}` : "CB —"}</span>
                  <Chip label={p.posType} color={C.cyan} bg="#051414" bd={C.cyan + "40"} />
                </div>
                <button onClick={() => removePosition(i)} style={iconButtonStyle()}>x</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={analyze} disabled={loading || !positions.length} style={primaryButtonStyle(!loading && positions.length > 0)}>
          {loading
            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><Spinner />{step}</span>
            : "ANALYZE PORTFOLIO"
          }
        </button>
        {error && <p style={{ color: C.red, fontSize: "0.62rem", fontFamily: C.mono, marginTop: 10 }}>! {error}</p>}
        {!positions.length && (
          <p style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono, marginTop: 10, lineHeight: 1.6 }}>
            Saved positions will appear here and sync with your signed-in app state.
          </p>
        )}
      </Card>

      {/* Results */}
      {results && (
        <>
          <Card>
            <SecHead left="PORTFOLIO SUMMARY" />
            {[
              { l: "Total Value", v: `$${(results.summary.totalValue / 1000).toFixed(1)}K` },
              { l: "Tracked Cost", v: results.summary.totalCostBasis > 0 ? `$${(results.summary.totalCostBasis / 1000).toFixed(1)}K` : "—" },
              { l: "Unrealized P&L", v: results.summary.unrealizedPct != null ? `${results.summary.unrealizedPnl >= 0 ? "+" : ""}$${results.summary.unrealizedPnl.toFixed(0)}` : "—", c: results.summary.unrealizedPct == null ? C.light : results.summary.unrealizedPnl >= 0 ? C.green : C.red },
              { l: "Unrealized Return", v: results.summary.unrealizedPct != null ? `${results.summary.unrealizedPct >= 0 ? "+" : ""}${results.summary.unrealizedPct.toFixed(1)}%` : "—", c: results.summary.unrealizedPct == null ? C.light : results.summary.unrealizedPct >= 0 ? C.green : C.red },
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, marginTop: 6 }}>
                      <div style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>Px ${Number(p.entry || 0).toFixed(2)}</div>
                      <div style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>CB {p.costBasis != null ? `$${Number(p.costBasis).toFixed(2)}` : "—"}</div>
                      <div style={{ color: p.unrealizedPnl == null ? C.dim : p.unrealizedPnl >= 0 ? C.green : C.red, fontSize: "0.55rem", fontFamily: C.mono }}>
                        P&amp;L {p.unrealizedPnl == null ? "—" : `${p.unrealizedPnl >= 0 ? "+" : ""}$${p.unrealizedPnl.toFixed(2)}`}
                      </div>
                      <div style={{ color: p.unrealizedPct == null ? C.dim : p.unrealizedPct >= 0 ? C.green : C.red, fontSize: "0.55rem", fontFamily: C.mono }}>
                        Return {p.unrealizedPct == null ? "—" : `${p.unrealizedPct >= 0 ? "+" : ""}${p.unrealizedPct.toFixed(1)}%`}
                      </div>
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
