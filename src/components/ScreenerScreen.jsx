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
import { SECTOR_ETFS, SECTOR_STOCKS } from "../api/universe.js";

const BUILTIN_WATCHLISTS = {
  "Mega Cap Tech": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA"],
  "ETFs": ["SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLK", "GLD", "TLT"],
  "Crypto": ["BTC", "ETH", "SOL", "XRP", "ADA", "AVAX", "LINK", "DOT"],
  "Growth": ["PLTR", "SNOW", "CRWD", "DDOG", "NET", "ZS", "MDB"],
  "Value / Dividend": ["JPM", "V", "JNJ", "PG", "KO", "PFE", "CVX"],
};

const CONFIRM_OPTIONS = ["OFF", "AUTO", "1H", "4H", "1D", "1W"];
const TIMEFRAME_OPTIONS = ["1H", "4H", "1D", "1W"];
const SORT_OPTIONS = [
  { id: "score", label: "BEST SCORE" },
  { id: "confidence", label: "BEST CONF" },
  { id: "rsi", label: "LOW RSI" },
  { id: "volume", label: "HIGH VOL" },
  { id: "mtf", label: "MTF ALIGN" },
];

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
  import("./VideoExport.jsx").then((module) => ({ default: module.VideoExportButton })),
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

function parseTickerInput(input) {
  return input
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean);
}

function getActiveTickers(customTickers, watchlist, savedWatchlists) {
  if (customTickers.trim()) return parseTickerInput(customTickers);
  return ({ ...BUILTIN_WATCHLISTS, ...savedWatchlists })[watchlist] || [];
}

function getActiveSourceLabel(customTickers, watchlist) {
  if (customTickers.trim()) return "CUSTOM LIST";
  return watchlist.toUpperCase();
}

function summarizeResults(cards = []) {
  if (!cards.length) return null;
  const valid = cards.filter((card) => !card.error);
  if (!valid.length) return null;
  const strongest = [...valid].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  return {
    strongest,
    longCount: valid.filter((card) => card.signal?.includes("LONG")).length,
    shortCount: valid.filter((card) => card.signal?.includes("SHORT")).length,
    neutralCount: valid.filter((card) => card.signal === "NEUTRAL").length,
  };
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
    return { ...card, mtf: buildMtfState(card.signal, confirmCard.signal, confirmTimeframe) };
  } catch (error) {
    return { ...card, mtf: buildMtfState(card.signal, null, confirmTimeframe, error.message) };
  }
}

function StepCard({ title, body, accent = C.green }) {
  return (
    <div style={{ background: "#081008", border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ color: accent, fontSize: "0.6rem", letterSpacing: "0.1em", fontFamily: C.mono, fontWeight: 700, marginBottom: 5 }}>{title}</div>
      <div style={{ color: C.mid, fontSize: "0.56rem", fontFamily: C.mono, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
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
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0, found: 0, phase: "" });
  const [minScore, setMinScore] = useState(() => persisted.minScore ?? 60);
  const [error, setError] = useState(null);
  const [scanTime, setScanTime] = useState(() => persisted.scanTime ? new Date(persisted.scanTime) : null);
  const [showHeatmap, setShowHeatmap] = useState(false);
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
    setLoading(true);
    setResults(null);
    setError(null);

    const tickers = getActiveTickers(customTickers, watchlist, savedWatchlists);
    if (!tickers.length) {
      setError("No tickers to scan.");
      setLoading(false);
      return;
    }

    const assetType = watchlist === "Crypto" || tickers.some((ticker) => ["BTC", "ETH", "SOL", "XRP", "ADA", "AVAX"].includes(ticker))
      ? "Crypto"
      : "US Stock";

    setProgress({ done: 0, total: tickers.length });
    const cards = [];

    for (let i = 0; i < tickers.length; i++) {
      try {
        const card = await buildScreenedCard(tickers[i], timeframe, assetType, confirmTimeframe);
        cards.push(card);
      } catch (scanError) {
        cards.push({
          ticker: tickers[i],
          signal: "NEUTRAL",
          score: 0,
          confidence: 0,
          entry: 0,
          rsi: 50,
          vol: 0,
          adx: 0,
          error: scanError.message,
        });
      }
      setProgress({ done: i + 1, total: tickers.length });
      if (i < tickers.length - 1) await new Promise((resolve) => setTimeout(resolve, 250));
    }

    setResults(cards);
    setScanTime(new Date());
    setLoading(false);
  };

  const autoScan = async () => {
    setAutoScanning(true);
    setResults(null);
    setError(null);

    const sectorScores = {};
    const allCards = [];
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
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const hotSectors = Object.entries(sectorScores)
      .filter(([, score]) => score >= 58)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    const coldSectors = Object.entries(sectorScores)
      .filter(([, score]) => score <= 42)
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);

    const sectorsToScan = [...hotSectors, ...coldSectors];
    if (!sectorsToScan.length) {
      const sortedSectors = Object.entries(sectorScores).sort((a, b) => b[1] - a[1]);
      sectorsToScan.push(...sortedSectors.slice(0, 3).map(([name]) => name));
      sectorsToScan.push(...sortedSectors.slice(-3).map(([name]) => name));
    }

    const tickersToScan = [];
    for (const sector of sectorsToScan) {
      tickersToScan.push(...(SECTOR_STOCKS[sector] || []));
    }
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
      if (i < uniqueTickers.length - 1) await new Promise((resolve) => setTimeout(resolve, 150));
    }

    setResults(allCards);
    setScanTime(new Date());
    setAutoScanning(false);
  };

  const sorted = results ? [...results].sort((a, b) => {
    if (sortBy === "score") return (b.score || 0) - (a.score || 0);
    if (sortBy === "confidence") return (b.confidence || 0) - (a.confidence || 0);
    if (sortBy === "rsi") return (a.rsi || 50) - (b.rsi || 50);
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
  const resultsConfirmTimeframe = sorted?.find((card) => card.mtf?.timeframe)?.mtf?.timeframe || null;
  const activeTickers = getActiveTickers(customTickers, watchlist, savedWatchlists);
  const sourceLabel = getActiveSourceLabel(customTickers, watchlist);
  const resultSummary = summarizeResults(sorted || []);

  return (
    <div className="fade">
      <Card>
        <SecHead left="SCREENER WORKFLOW" right="SOURCE → FILTER → RUN" />
        <p style={{ color: C.dim, fontSize: "0.62rem", fontFamily: C.mono, lineHeight: 1.65, marginBottom: 14 }}>
          Use a quick watchlist scan when you already know the names. Use auto sector drill when you want the app to hunt for stronger themes first.
        </p>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <Chip label={`SOURCE ${sourceLabel}`} color={C.cyan} bg="#051414" bd={`${C.cyan}35`} />
          <Chip label={`${activeTickers.length} TICKERS`} color={C.mid} bg="#101610" bd={C.border} />
          <Chip label={`TF ${timeframe}`} color={C.green} bg="#0b2214" bd={`${C.green}40`} />
          <Chip
            label={confirmTimeframe ? `MTF ${timeframe}/${confirmTimeframe}` : "MTF OFF"}
            color={confirmTimeframe ? C.yellow : C.dim}
            bg={confirmTimeframe ? "#191400" : "#101610"}
            bd={confirmTimeframe ? "#504400" : C.border}
          />
        </div>

        <div style={{ background: "#0a120a", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ color: C.light, fontSize: "0.62rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 8 }}>STEP 1 · CHOOSE A SOURCE LIST</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {Object.keys({ ...BUILTIN_WATCHLISTS, ...savedWatchlists }).map((name) => (
              <button
                key={name}
                onClick={() => {
                  setWatchlist(name);
                  setCustomTickers("");
                  setLastWatchlist(name);
                }}
                style={{
                  background: watchlist === name && !customTickers ? "#0d2a18" : C.card,
                  border: `1px solid ${watchlist === name && !customTickers ? C.green : C.border}`,
                  color: watchlist === name && !customTickers ? C.green : C.mid,
                  borderRadius: 5,
                  padding: "5px 12px",
                  fontSize: "0.62rem",
                  fontFamily: C.mono,
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ color: C.dim, fontSize: "0.55rem", letterSpacing: "0.1em", fontFamily: C.mono, display: "block", marginBottom: 4 }}>
              CUSTOM TICKERS
            </label>
            <input
              value={customTickers}
              onChange={(e) => setCustomTickers(e.target.value.toUpperCase())}
              placeholder="AAPL, MSFT, TSLA"
              style={{ width: "100%", background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "8px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.75rem" }}
            />
          </div>
          {customTickers.trim() && (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Watchlist name"
                style={{ flex: 1, background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.65rem" }}
              />
              <button
                onClick={() => {
                  if (!saveName.trim()) return;
                  saveWatchlist(saveName.trim(), parseTickerInput(customTickers));
                  setSavedWatchlists(getWatchlists());
                  setSaveName("");
                }}
                style={{
                  background: "#0d2a18",
                  border: `1px solid ${C.green}`,
                  color: C.green,
                  borderRadius: 5,
                  padding: "6px 12px",
                  fontSize: "0.58rem",
                  fontFamily: C.mono,
                  fontWeight: 700,
                }}
              >
                SAVE
              </button>
            </div>
          )}
        </div>

        <div style={{ background: "#0a120a", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ color: C.light, fontSize: "0.62rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 8 }}>STEP 2 · SET SCAN RULES</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, display: "block", marginBottom: 4 }}>TIMEFRAME</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                style={{ width: "100%", background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }}
              >
                {TIMEFRAME_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, display: "block", marginBottom: 4 }}>MTF CHECK</label>
              <select
                value={confirmMode}
                onChange={(e) => setConfirmMode(e.target.value)}
                style={{ width: "100%", background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }}
              >
                {CONFIRM_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, display: "block", marginBottom: 4 }}>SORT RESULTS</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ width: "100%", background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }}
              >
                {SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, display: "block", marginBottom: 4 }}>AUTO MIN SCORE</label>
              <input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                min={30}
                max={90}
                step={5}
                style={{ width: "100%", background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 10px", color: C.light, fontFamily: C.mono, fontSize: "0.75rem" }}
              />
            </div>
          </div>
          <p style={{ color: C.dim, fontSize: "0.52rem", fontFamily: C.mono }}>
            {confirmTimeframe
              ? `Primary results come from ${timeframe}, then ${confirmTimeframe} is used to confirm or challenge the setup.`
              : "Primary results use only the selected timeframe with no higher-timeframe confirmation."}
          </p>
        </div>

        <div style={{ background: "#0a120a", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ color: C.light, fontSize: "0.62rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 8 }}>STEP 3 · RUN THE RIGHT SCAN</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
            <StepCard
              title="WATCHLIST SCAN"
              body="Ranks your chosen list from best to worst. Use this when you already know the names you care about."
              accent={C.green}
            />
            <StepCard
              title="AUTO SECTOR DRILL"
              body="Starts with sector ETFs, then drills into the strongest and weakest groups to find fresh stock candidates."
              accent={C.yellow}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <button
              onClick={scan}
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#0a120a" : "linear-gradient(135deg,#0d2e18,#0f3820)",
                border: `1px solid ${loading ? C.border : C.green}`,
                color: loading ? C.dim : C.green,
                borderRadius: 7,
                padding: "12px 0",
                fontSize: "0.74rem",
                letterSpacing: "0.14em",
                fontWeight: 700,
              }}
            >
              {loading
                ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><Spinner /> WATCHLIST {progress.done}/{progress.total}</span>
                : "RUN WATCHLIST SCAN"}
            </button>
            <button
              onClick={autoScan}
              disabled={autoScanning || loading}
              style={{
                width: "100%",
                background: autoScanning ? "#0a120a" : "#141100",
                border: `1px solid ${autoScanning ? C.border : "#504400"}`,
                color: autoScanning ? C.dim : C.yellow,
                borderRadius: 7,
                padding: "12px 0",
                fontSize: "0.74rem",
                letterSpacing: "0.14em",
                fontWeight: 700,
              }}
            >
              {autoScanning
                ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Spinner /> {scanProgress.phase || "AUTO SCAN"} {scanProgress.done}/{scanProgress.total}</span>
                : "RUN AUTO SECTOR DRILL"}
            </button>
          </div>

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
                marginTop: 10,
              }}
            >
              CLEAR LAST SCAN
            </button>
          )}
        </div>

        {error && <p style={{ color: C.red, fontSize: "0.62rem", fontFamily: C.mono, marginTop: 10 }}>! {error}</p>}
        {!loading && !autoScanning && results && scanTime && (
          <p style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, marginTop: 10 }}>
            Last scan cached locally from {scanTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
          </p>
        )}
      </Card>

      {sorted && (
        <Card>
          <SecHead left="SCAN RESULTS" right={scanTime ? scanTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null} />

          {resultSummary && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <Chip label={`BEST ${resultSummary.strongest.ticker} S${resultSummary.strongest.score}`} color={C.green} bg="#0b2214" bd={`${C.green}40`} />
              <Chip label={`LONG ${resultSummary.longCount}`} color={C.green} bg="#0b2214" bd={`${C.green}40`} />
              <Chip label={`SHORT ${resultSummary.shortCount}`} color={C.red} bg="#1a0808" bd={`${C.red}40`} />
              <Chip label={`NEUTRAL ${resultSummary.neutralCount}`} color={C.yellow} bg="#191400" bd="#504400" />
              <Chip label={`SOURCE ${sourceLabel}`} color={C.cyan} bg="#051414" bd={`${C.cyan}35`} />
            </div>
          )}

          <div style={{ background: "#0a120a", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, alignItems: "start" }}>
              <div>
                <div style={{ color: C.dim, fontSize: "0.5rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 5 }}>HOW TO USE THIS LIST</div>
                <div style={{ color: C.mid, fontSize: "0.57rem", fontFamily: C.mono, lineHeight: 1.55 }}>
                  Top rows are your strongest current setups. Tap any ticker to open the full analysis page with trade plan, evidence, and history.
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {resultsConfirmTimeframe && mtfSummary && (
                  <>
                    <Chip label={`${resultsConfirmTimeframe} ALIGNED ${mtfSummary.ALIGNED || 0}`} color={C.green} bg="#0b2214" bd={`${C.green}40`} />
                    <Chip label={`${resultsConfirmTimeframe} CONFLICT ${mtfSummary.CONFLICT || 0}`} color={C.red} bg="#1a0808" bd={`${C.red}40`} />
                  </>
                )}
                {sorted.length > 0 && scanTime && (
                  <Suspense fallback={<LazyInlineFallback label="LOADING VIDEO" />}>
                    <VideoExportButton
                      type="leaderboard"
                      props={buildLeaderboardVideoProps(sorted, scanTime)}
                      label="VIDEO FOR X"
                    />
                  </Suspense>
                )}
              </div>
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
            {sorted.map((result, index) => {
              const meta = SIGNALS[result.signal] || SIGNALS.NEUTRAL;
              const mtfChip = getMtfChipProps(result.mtf);
              return (
                <button
                  key={result.ticker}
                  onClick={() => onSelectTicker && onSelectTicker(result)}
                  style={{
                    background: "#090f09",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, minWidth: 16 }}>#{index + 1}</span>
                      <span style={{ color: C.light, fontFamily: C.raj, fontSize: "0.98rem", fontWeight: 700, minWidth: 52 }}>{result.ticker}</span>
                      <Chip label={result.signal || "ERR"} color={meta.color} bg={meta.color + "18"} bd={meta.color + "40"} />
                      {mtfChip && <Chip {...mtfChip} />}
                    </div>
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {result.error
                        ? <span style={{ color: C.red, fontSize: "0.55rem", fontFamily: C.mono }}>err</span>
                        : <>
                            <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>SCORE {result.score}</span>
                            <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>CONF {result.confidence}%</span>
                            <span style={{ color: result.rsi > 70 ? C.red : result.rsi < 30 ? C.green : C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>RSI {Number(result.rsi).toFixed(0)}</span>
                            <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>PX ${result.entry}</span>
                          </>}
                    </div>
                  </div>

                  {!result.error && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6, marginBottom: result.mtf && result.mtf.status !== "OFF" ? 6 : 0 }}>
                      <div style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono }}>Bias: <span style={{ color: meta.color }}>{result.signal}</span></div>
                      <div style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono }}>Volume: <span style={{ color: C.light }}>{result.vol}x</span></div>
                      <div style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono }}>ADX: <span style={{ color: C.light }}>{result.adx}</span></div>
                      <div style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono }}>Tap to open full setup</div>
                    </div>
                  )}

                  {!result.error && result.mtf && result.mtf.status !== "OFF" && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono, lineHeight: 1.4 }}>
                        {result.mtf.signal
                          ? `${result.timeframe}: ${result.signal} | ${result.mtf.timeframe}: ${result.mtf.signal}`
                          : `${result.mtf.timeframe}: confirmation unavailable`}
                      </span>
                      <span style={{ color: result.mtf.status === "ALIGNED" ? C.green : result.mtf.status === "CONFLICT" ? C.red : C.yellow, fontSize: "0.5rem", fontFamily: C.mono, whiteSpace: "nowrap" }}>
                        {result.mtf.message}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <SecHead left="OPTIONAL SECTOR HEATMAP" right="BREADTH CHECK" />
          <button
            onClick={() => setShowHeatmap((value) => !value)}
            style={{
              background: showHeatmap ? "#0d2a18" : "transparent",
              border: `1px solid ${showHeatmap ? C.green : C.border}`,
              color: showHeatmap ? C.green : C.dim,
              borderRadius: 5,
              padding: "5px 12px",
              fontSize: "0.58rem",
              fontFamily: C.mono,
              fontWeight: 700,
            }}
          >
            {showHeatmap ? "HIDE HEATMAP" : "SHOW HEATMAP"}
          </button>
        </div>
        <p style={{ color: C.dim, fontSize: "0.56rem", fontFamily: C.mono, lineHeight: 1.55, marginBottom: showHeatmap ? 12 : 0 }}>
          Use this after the main screener if you want a quick view of sector breadth. It is context, not the main workflow.
        </p>
        {showHeatmap && (
          <Suspense fallback={<LazyInlineFallback label="LOADING HEATMAP" />}>
            <SectorHeatmap />
          </Suspense>
        )}
      </Card>
    </div>
  );
}
