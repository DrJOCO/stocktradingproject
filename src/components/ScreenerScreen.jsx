// Screener — scan a watchlist of tickers and rank by signal strength

import { lazy, Suspense, useEffect, useState } from "react";
import { C, Card, Chip, SecHead, Spinner } from "./ui.jsx";
import {
  getWatchlists,
  saveWatchlist,
  getLastWatchlist,
  getScreenerState,
  saveScreenerState,
  setLastWatchlist,
} from "../utils/storage.js";
import { buildLeaderboardVideoProps } from "./videoExportProps.js";
import { fetchCandleData } from "../api/finnhub.js";
import { buildSignalCard, SIGNALS } from "../indicators/scoring.js";

const BUILTIN_WATCHLISTS = {
  "Mega Cap Tech": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA"],
  "ETFs": ["SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLK", "GLD", "TLT"],
  "Crypto": ["BTC", "ETH", "SOL", "XRP", "ADA", "AVAX", "LINK", "DOT"],
  "Growth": ["PLTR", "SNOW", "CRWD", "DDOG", "NET", "ZS", "MDB"],
  "Value / Dividend": ["JPM", "V", "JNJ", "PG", "KO", "PFE", "CVX"],
};

import { SECTOR_ETFS, SECTOR_STOCKS } from "../api/universe.js";

const CONFIRM_OPTIONS = ["OFF", "AUTO", "1H", "4H", "1D", "1W"];
const AUTO_CONFIRM_MAP = {
  "1H": "4H",
  "4H": "1D",
  "1D": "1W",
  "1W": null,
};
const MTF_SORT_RANK = {
  ALIGNED: 4,
  MIXED: 3,
  UNAVAILABLE: 2,
  OFF: 1,
  CONFLICT: 0,
};

const SectorHeatmap = lazy(() => import("./SectorHeatmap.jsx"));
const VideoExportButton = lazy(() =>
  import("./VideoExport.jsx").then((module) => ({ default: module.VideoExportButton }))
);

function LazyInlineFallback({ label = "LOADING" }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      color: C.dim,
      fontSize: "0.55rem",
      fontFamily: C.mono,
    }}>
      <Spinner size={10} />
      <span>{label}</span>
    </div>
  );
}

function resolveConfirmationTimeframe(primaryTimeframe, confirmMode) {
  if (confirmMode === "OFF") return null;
  if (confirmMode === "AUTO") return AUTO_CONFIRM_MAP[primaryTimeframe] || null;
  if (confirmMode === primaryTimeframe) return null;
  return confirmMode;
}

function getSignalBias(signal) {
  if (!signal) return "NEUTRAL";
  if (signal.includes("LONG")) return "LONG";
  if (signal.includes("SHORT")) return "SHORT";
  return "NEUTRAL";
}

function buildMtfState(primarySignal, confirmSignal, confirmTimeframe, error = null) {
  if (!confirmTimeframe) {
    return { status: "OFF", timeframe: null, signal: null, aligned: null, message: null };
  }

  if (error) {
    return {
      status: "UNAVAILABLE",
      timeframe: confirmTimeframe,
      signal: null,
      aligned: null,
      message: error,
    };
  }

  const primaryBias = getSignalBias(primarySignal);
  const confirmBias = getSignalBias(confirmSignal);

  if (primaryBias === "NEUTRAL" || confirmBias === "NEUTRAL") {
    return {
      status: "MIXED",
      timeframe: confirmTimeframe,
      signal: confirmSignal,
      aligned: null,
      message: `${confirmTimeframe} is neutral or mixed`,
    };
  }

  const aligned = primaryBias === confirmBias;
  return {
    status: aligned ? "ALIGNED" : "CONFLICT",
    timeframe: confirmTimeframe,
    signal: confirmSignal,
    aligned,
    message: aligned ? `${confirmTimeframe} agrees with the primary signal` : `${confirmTimeframe} diverges from the primary signal`,
  };
}

function getMtfChipProps(mtf) {
  if (!mtf || mtf.status === "OFF") return null;
  if (mtf.status === "ALIGNED") {
    return { label: `${mtf.timeframe} ALIGNED`, color: C.green, bg: "#0b2214", bd: `${C.green}40` };
  }
  if (mtf.status === "CONFLICT") {
    return { label: `${mtf.timeframe} CONFLICT`, color: C.red, bg: "#1a0808", bd: `${C.red}40` };
  }
  if (mtf.status === "MIXED") {
    return { label: `${mtf.timeframe} MIXED`, color: C.yellow, bg: "#191400", bd: `${C.yellow}40` };
  }
  return { label: `${mtf.timeframe} N/A`, color: C.dim, bg: "#101610", bd: `${C.border}` };
}

async function buildScreenedCard(ticker, timeframe, assetType, confirmTimeframe) {
  const raw = await fetchCandleData(ticker, timeframe, assetType);
  const card = buildSignalCard(ticker, timeframe, raw);

  if (!confirmTimeframe) {
    return { ...card, mtf: buildMtfState(card.signal, null, null) };
  }

  try {
    const confirmRaw = await fetchCandleData(ticker, confirmTimeframe, assetType);
    const confirmCard = buildSignalCard(ticker, confirmTimeframe, confirmRaw);
    return {
      ...card,
      mtf: buildMtfState(card.signal, confirmCard.signal, confirmTimeframe),
    };
  } catch (error) {
    return {
      ...card,
      mtf: buildMtfState(card.signal, null, confirmTimeframe, error.message),
    };
  }
}

export default function ScreenerScreen({ onSelectTicker }) {
  const [persisted] = useState(() => getScreenerState());
  const [watchlist, setWatchlist] = useState(() => persisted.watchlist || getLastWatchlist() || "Mega Cap Tech");
  const [savedWatchlists, setSavedWatchlists] = useState(() => getWatchlists());
  const [saveName, setSaveName] = useState("");
  const [customTickers, setCustomTickers] = useState(() => persisted.customTickers || "");
  const [timeframe, setTimeframe] = useState(() => persisted.timeframe || "1D");
  const [confirmMode, setConfirmMode] = useState(() => persisted.confirmMode || "AUTO");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(() => persisted.results || null);
  const [sortBy, setSortBy] = useState(() => persisted.sortBy || "score");
  const [autoScanning, setAutoScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0, found: 0 });
  const [minScore, setMinScore] = useState(() => persisted.minScore ?? 60);
  const [error, setError] = useState(null);
  const [scanTime, setScanTime] = useState(() => persisted.scanTime ? new Date(persisted.scanTime) : null);
  const confirmTimeframe = resolveConfirmationTimeframe(timeframe, confirmMode);

  useEffect(() => {
    saveScreenerState({
      watchlist,
      customTickers,
      timeframe,
      confirmMode,
      sortBy,
      minScore,
      results,
      scanTime: scanTime ? scanTime.toISOString() : null,
    });
  }, [watchlist, customTickers, timeframe, confirmMode, sortBy, minScore, results, scanTime]);

  const scan = async () => {
    setLoading(true); setResults(null); setError(null);

    let tickers;
    if (customTickers.trim()) {
      tickers = customTickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
    } else {
      tickers = ({...BUILTIN_WATCHLISTS, ...savedWatchlists})[watchlist] || [];
    }

    if (!tickers.length) { setError("No tickers to scan."); setLoading(false); return; }

    const assetType = watchlist === "Crypto" || tickers.some(t => ["BTC", "ETH", "SOL", "XRP", "ADA", "AVAX"].includes(t)) ? "Crypto" : "US Stock";
    setProgress({ done: 0, total: tickers.length });

    const cards = [];
    for (let i = 0; i < tickers.length; i++) {
      try {
        const card = await buildScreenedCard(tickers[i], timeframe, assetType, confirmTimeframe);
        cards.push(card);
      } catch (e) {
        cards.push({ ticker: tickers[i], signal: "NEUTRAL", score: 0, confidence: 0, entry: 0, rsi: 50, vol: 0, adx: 0, error: e.message });
      }
      setProgress({ done: i + 1, total: tickers.length });
      if (i < tickers.length - 1) await new Promise(r => setTimeout(r, 250));
    }

    setResults(cards);
    setScanTime(new Date());
    setLoading(false);
  };

  // Smart scan: sectors first, then drill into hot/cold sectors
  const autoScan = async () => {
    setAutoScanning(true); setResults(null); setError(null);

    const sectorScores = {};
    const allCards = [];

    // Phase 1: Scan sector ETFs to find hot/cold sectors
    const sectorNames = Object.keys(SECTOR_ETFS);
    setScanProgress({ done: 0, total: sectorNames.length, found: 0, phase: "Scanning sectors" });

    for (let i = 0; i < sectorNames.length; i++) {
      const name = sectorNames[i];
      const etf = SECTOR_ETFS[name];
      try {
        const raw = await fetchCandleData(etf, timeframe, "ETF");
        const card = buildSignalCard(etf, timeframe, raw);
        sectorScores[name] = card.score;
      } catch {
        sectorScores[name] = 50;
      }
      setScanProgress({ done: i + 1, total: sectorNames.length, found: 0, phase: "Scanning sectors" });
      await new Promise(r => setTimeout(r, 150));
    }

    // Phase 2: Pick the hottest (score >= 60) and coldest (score <= 40) sectors
    const hotSectors = Object.entries(sectorScores)
      .filter(([, score]) => score >= 58)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    const coldSectors = Object.entries(sectorScores)
      .filter(([, score]) => score <= 42)
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);

    const sectorsToScan = [...hotSectors, ...coldSectors];
    // If no extreme sectors, scan top 3 and bottom 3
    if (!sectorsToScan.length) {
      const sorted = Object.entries(sectorScores).sort((a, b) => b[1] - a[1]);
      sectorsToScan.push(...sorted.slice(0, 3).map(([n]) => n));
      sectorsToScan.push(...sorted.slice(-3).map(([n]) => n));
    }

    // Phase 3: Scan individual stocks in those sectors
    const tickersToScan = [];
    for (const sector of sectorsToScan) {
      const stocks = SECTOR_STOCKS[sector] || [];
      tickersToScan.push(...stocks);
    }
    // Remove dupes
    const uniqueTickers = [...new Set(tickersToScan)];

    setScanProgress({ done: 0, total: uniqueTickers.length, found: 0, phase: `Drilling into ${sectorsToScan.length} sectors` });

    for (let i = 0; i < uniqueTickers.length; i++) {
      try {
        const card = await buildScreenedCard(uniqueTickers[i], timeframe, "US Stock", confirmTimeframe);
        if (card.score >= minScore || card.score <= (100 - minScore)) {
          allCards.push(card);
        }
      } catch (scanError) {
        void scanError;
      }
      setScanProgress({ done: i + 1, total: uniqueTickers.length, found: allCards.length, phase: `Drilling into ${sectorsToScan.length} sectors` });
      if (i < uniqueTickers.length - 1) await new Promise(r => setTimeout(r, 150));
    }

    setResults(allCards);
    setScanTime(new Date());
    setAutoScanning(false);
  };


  const sorted = results ? [...results].sort((a, b) => {
    if (sortBy === "score") return (b.score || 0) - (a.score || 0);
    if (sortBy === "confidence") return (b.confidence || 0) - (a.confidence || 0);
    if (sortBy === "rsi") return (a.rsi || 50) - (b.rsi || 50); // low RSI first (oversold)
    if (sortBy === "volume") return (b.vol || 0) - (a.vol || 0);
    if (sortBy === "mtf") {
      const mtfDiff = (MTF_SORT_RANK[b.mtf?.status || "OFF"] || 0) - (MTF_SORT_RANK[a.mtf?.status || "OFF"] || 0);
      if (mtfDiff !== 0) return mtfDiff;
      return (b.score || 0) - (a.score || 0);
    }
    return 0;
  }) : null;

  const mtfSummary = sorted?.reduce((acc, card) => {
    const status = card.mtf?.status || "OFF";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, { ALIGNED: 0, CONFLICT: 0, MIXED: 0, UNAVAILABLE: 0, OFF: 0 });
  const resultsConfirmTimeframe = sorted?.find(card => card.mtf?.timeframe)?.mtf?.timeframe || null;

  return (
    <div className="fade">
      <Card>
        <SecHead left="STOCK SCREENER" right="SCAN WATCHLIST" />
        <p style={{ color: C.dim, fontSize: "0.62rem", fontFamily: C.mono, lineHeight: 1.65, marginBottom: 14 }}>
          Scan a group of tickers and rank them by signal strength. Pick the best setups.
        </p>

        {/* Watchlist selector */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.keys({...BUILTIN_WATCHLISTS, ...savedWatchlists}).map(name => (
            <button key={name} onClick={() => { setWatchlist(name); setCustomTickers(""); setLastWatchlist(name); }}
              style={{
                background: watchlist === name && !customTickers ? "#0d2a18" : C.card,
                border: `1px solid ${watchlist === name && !customTickers ? C.green : C.border}`,
                color: watchlist === name && !customTickers ? C.green : C.mid,
                borderRadius: 5, padding: "5px 12px", fontSize: "0.62rem", fontFamily: C.mono,
              }}>
              {name}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ color: C.dim, fontSize: "0.55rem", letterSpacing: "0.1em", fontFamily: C.mono, display: "block", marginBottom: 4 }}>
            OR ENTER CUSTOM TICKERS (comma separated)
          </label>
          <input value={customTickers} onChange={e => setCustomTickers(e.target.value.toUpperCase())}
            placeholder="AAPL, MSFT, TSLA"
            style={{ width: "100%", background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "8px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.75rem" }} />
        </div>

        {/* Save custom watchlist */}
        {customTickers.trim() && (
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Watchlist name"
              style={{ flex: 1, background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.65rem" }} />
            <button onClick={() => {
              if (!saveName.trim()) return;
              const tickers = customTickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean);
              saveWatchlist(saveName.trim(), tickers);
              setSavedWatchlists(getWatchlists());
              setSaveName("");
            }} style={{
              background: "#0d2a18", border: `1px solid ${C.green}`, color: C.green,
              borderRadius: 5, padding: "6px 12px", fontSize: "0.58rem", fontFamily: C.mono, fontWeight: 700,
            }}>SAVE</button>
          </div>
        )}

        {/* Timeframe */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <label style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>TIMEFRAME</label>
          <select value={timeframe} onChange={e => setTimeframe(e.target.value)}
            style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }}>
            {["1H", "4H", "1D", "1W"].map(t => <option key={t}>{t}</option>)}
          </select>
          <label style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>MTF</label>
          <select value={confirmMode} onChange={e => setConfirmMode(e.target.value)}
            style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }}>
            {CONFIRM_OPTIONS.map(option => <option key={option}>{option}</option>)}
          </select>
          {(results || customTickers || scanTime) && (
            <button
              onClick={() => {
                setResults(null);
                setScanTime(null);
                setError(null);
                saveScreenerState({
                  watchlist,
                  customTickers,
                  timeframe,
                  confirmMode,
                  sortBy,
                  minScore,
                  results: null,
                  scanTime: null,
                });
              }}
              style={{
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: "6px 10px",
                color: C.dim,
                fontFamily: C.mono,
                fontSize: "0.6rem",
              }}
            >
              CLEAR LAST SCAN
            </button>
          )}
        </div>
        <p style={{ color: C.dim, fontSize: "0.52rem", fontFamily: C.mono, marginTop: -8, marginBottom: 12 }}>
          {confirmTimeframe
            ? `Companion timeframe confirmation active: ${timeframe} vs ${confirmTimeframe}.`
            : "Companion timeframe confirmation is off for this screener run."}
        </p>

        {/* Auto-Scan */}
        <div style={{ background: "#0a120a", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: C.green, fontSize: "0.6rem", letterSpacing: "0.12em", fontFamily: C.mono, fontWeight: 700 }}>AUTO-SCAN</span>
            <span style={{ color: C.dim, fontSize: "0.53rem", fontFamily: C.mono }}>S&P 500</span>
          </div>
          <p style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, lineHeight: 1.5, marginBottom: 10 }}>
            Step 1: Scans all 11 S&P sector ETFs. Step 2: Drills into the hottest and coldest sectors to find individual stock plays.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <label style={{ color: C.dim, fontSize: "0.53rem", fontFamily: C.mono }}>MIN SCORE</label>
            <input type="number" value={minScore} onChange={e => setMinScore(Number(e.target.value))}
              min={30} max={90} step={5}
              style={{ width: 60, background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "5px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.75rem" }} />
            <span style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono }}>
              {minScore >= 72 ? "STRONG LONG only" : minScore >= 58 ? "LONG BIAS+" : minScore >= 43 ? "includes NEUTRAL" : "wide net"}
            </span>
          </div>
          <button onClick={autoScan} disabled={autoScanning || loading} style={{
            width: "100%",
            background: autoScanning ? "#0a120a" : "linear-gradient(135deg,#0d2e18,#0f3820)",
            border: `1px solid ${autoScanning ? C.border : C.green}`,
            color: autoScanning ? C.dim : C.green,
            borderRadius: 7, padding: "10px 0", fontSize: "0.7rem", letterSpacing: "0.12em", fontWeight: 700,
          }}>
            {autoScanning
              ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Spinner /> {scanProgress.phase || "Scanning"} · {scanProgress.done}/{scanProgress.total} · {scanProgress.found} signals
                </span>
              : "AUTO-SCAN TOP SIGNALS"
            }
          </button>
        </div>

        <div style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono, textAlign: "center", marginBottom: 8, letterSpacing: "0.1em" }}>— OR SCAN A WATCHLIST —</div>

        <button onClick={scan} disabled={loading} style={{
          width: "100%",
          background: loading ? "#0a120a" : "linear-gradient(135deg,#0d2e18,#0f3820)",
          border: `1px solid ${loading ? C.border : C.green}`,
          color: loading ? C.dim : C.green,
          borderRadius: 7, padding: "12px 0", fontSize: "0.75rem", letterSpacing: "0.15em", fontWeight: 700,
        }}>
          {loading
            ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <Spinner /> Scanning {progress.done}/{progress.total}
              </span>
            : "SCAN WATCHLIST"
          }
        </button>

        {error && <p style={{ color: C.red, fontSize: "0.62rem", fontFamily: C.mono, marginTop: 10 }}>! {error}</p>}
        {!loading && !autoScanning && results && scanTime && (
          <p style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, marginTop: 10 }}>
            Last scan cached locally from {scanTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
          </p>
        )}
      </Card>

      {/* Sector Heatmap */}
      <Suspense fallback={<Card><LazyInlineFallback label="LOADING HEATMAP" /></Card>}>
        <SectorHeatmap />
      </Suspense>

      {/* Results */}
      {sorted && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <SecHead left={`${sorted.length} RESULTS`} />
              {scanTime && <span style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono }}>
                {scanTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
              </span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["score", "confidence", "rsi", "volume", "mtf"].map(s => (
                <button key={s} onClick={() => setSortBy(s)} style={{
                  background: sortBy === s ? "#0d2a18" : "transparent",
                  border: `1px solid ${sortBy === s ? C.green : C.border}`,
                  color: sortBy === s ? C.green : C.dim,
                  borderRadius: 4, padding: "3px 8px", fontSize: "0.55rem", fontFamily: C.mono,
                }}>
                  {s.toUpperCase()}
                </button>
              ))}
              {sorted && sorted.length > 0 && scanTime && (
                <Suspense fallback={<LazyInlineFallback label="LOADING VIDEO" />}>
                  <VideoExportButton type="leaderboard"
                    props={buildLeaderboardVideoProps(sorted, scanTime)}
                    label="VIDEO" />
                </Suspense>
              )}
            </div>
          </div>

          {resultsConfirmTimeframe && mtfSummary && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <Chip label={`${resultsConfirmTimeframe} ALIGNED ${mtfSummary.ALIGNED || 0}`} color={C.green} bg="#0b2214" bd={`${C.green}40`} />
              <Chip label={`${resultsConfirmTimeframe} CONFLICT ${mtfSummary.CONFLICT || 0}`} color={C.red} bg="#1a0808" bd={`${C.red}40`} />
              <Chip label={`${resultsConfirmTimeframe} MIXED ${mtfSummary.MIXED || 0}`} color={C.yellow} bg="#191400" bd={`${C.yellow}40`} />
              {!!(mtfSummary.UNAVAILABLE || 0) && (
                <Chip label={`${resultsConfirmTimeframe} N/A ${mtfSummary.UNAVAILABLE || 0}`} color={C.dim} bg="#101610" bd={C.border} />
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sorted.map((r, i) => {
              const meta = SIGNALS[r.signal] || SIGNALS["NEUTRAL"];
              const mtfChip = getMtfChipProps(r.mtf);
              return (
                <button key={r.ticker} onClick={() => onSelectTicker && onSelectTicker(r)}
                  style={{
                    background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 7,
                    padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
                    textAlign: "left", width: "100%",
                  }}>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, minWidth: 16 }}>#{i + 1}</span>
                        <span style={{ color: C.light, fontFamily: C.raj, fontSize: "0.95rem", fontWeight: 700, minWidth: 52 }}>{r.ticker}</span>
                        <Chip label={r.signal || "ERR"} color={meta.color} bg={meta.color + "18"} bd={meta.color + "40"} />
                        {mtfChip && <Chip {...mtfChip} />}
                      </div>
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        {r.error
                          ? <span style={{ color: C.red, fontSize: "0.55rem", fontFamily: C.mono }}>err</span>
                          : <>
                              <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>S{r.score}</span>
                              <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>C{r.confidence}%</span>
                              <span style={{ color: r.rsi > 70 ? C.red : r.rsi < 30 ? C.green : C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>R{Number(r.rsi).toFixed(0)}</span>
                              <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>${r.entry}</span>
                            </>
                        }
                      </div>
                    </div>
                    {!r.error && r.mtf && r.mtf.status !== "OFF" && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <span style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono, lineHeight: 1.4 }}>
                          {r.mtf.signal
                            ? `${r.timeframe}: ${r.signal} | ${r.mtf.timeframe}: ${r.mtf.signal}`
                            : `${r.mtf.timeframe}: confirmation unavailable`}
                        </span>
                        <span style={{ color: r.mtf.status === "ALIGNED" ? C.green : r.mtf.status === "CONFLICT" ? C.red : C.yellow, fontSize: "0.5rem", fontFamily: C.mono, whiteSpace: "nowrap" }}>
                          {r.mtf.message}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
