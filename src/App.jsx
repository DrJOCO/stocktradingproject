import { lazy, Suspense, useState, useCallback } from "react";
import { GlobalStyles, C, ErrorBanner, Spinner } from "./components/ui.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import AnalyzeScreen from "./components/AnalyzeScreen.jsx";
import QuickLogButton from "./components/QuickLogButton.jsx";
import { Commentary, AISummary, SignalHeader, EarlyWarnings, PatternBreakouts, SignalCards, OptionsPlay, BacktestCard, MTFBadge, EarningsCard } from "./components/SignalResult.jsx";
import { AlertNotifications, AlertSetButton, AlertsList } from "./components/AlertsPanel.jsx";
import { buildSignalVideoProps } from "./components/videoExportProps.js";
import { fetchCandleData, fetchBacktestData, fetchEarnings } from "./api/finnhub.js";
import { buildSignalCard, rescoreWithAdaptiveWeights } from "./indicators/scoring.js";
import { runBacktest } from "./backtest/engine.js";
import { checkAlerts } from "./utils/alerts.js";

const ScreenerScreen = lazy(() => import("./components/ScreenerScreen.jsx"));
const PortfolioScreen = lazy(() => import("./components/PortfolioScreen.jsx"));
const JournalScreen = lazy(() => import("./components/JournalScreen.jsx"));
const PositionSizer = lazy(() => import("./components/PositionSizer.jsx"));
const VideoExportButton = lazy(() =>
  import("./components/VideoExport.jsx").then((module) => ({ default: module.VideoExportButton }))
);

function SectionFallback({ label = "LOADING" }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: "16px 14px",
      marginBottom: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      color: C.dim,
      fontSize: "0.6rem",
      letterSpacing: "0.1em",
      fontFamily: C.mono,
    }}>
      <Spinner size={11} />
      <span>{label}</span>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("analyze");
  const [result, setResult] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [assetType, setAssetType] = useState("US Stock");
  const [error, setError] = useState(null);
  const [backtestStats, setBacktestStats] = useState(null);
  const [weeklySignal, setWeeklySignal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [indicatorReport, setIndicatorReport] = useState(null);
  const [earnings, setEarnings] = useState(null);

  const handleResult = useCallback(async (d, ai, at) => {
    setResult(d);
    setAnalysis(ai);
    setAssetType(at);
    setError(null);

    // Run backtest on extended 2-year data + learn adaptive weights
    try {
      const btRaw = await fetchBacktestData(d.ticker, at);
      const bt = runBacktest(btRaw);
      setBacktestStats(bt.stats);
      setIndicatorReport(bt.indicatorReport);

      // Re-score the signal using learned adaptive weights
      if (bt.adaptiveWeights) {
        const liveRaw = await fetchCandleData(d.ticker, d.timeframe, at);
        const rescored = rescoreWithAdaptiveWeights(d, liveRaw, bt.adaptiveWeights);
        setResult(rescored);
        setAnalysis(rescored.analysis);
      }
    } catch {
      setBacktestStats(null);
      setIndicatorReport(null);
    }

    // Fetch weekly for MTF confirmation (if not already weekly)
    if (d.timeframe !== "1W") {
      try {
        const weeklyRaw = await fetchCandleData(d.ticker, "1W", at);
        const weeklyCard = buildSignalCard(d.ticker, "1W", weeklyRaw);
        setWeeklySignal(weeklyCard.signal);
      } catch { setWeeklySignal(null); }
    } else {
      setWeeklySignal(null);
    }

    // Fetch earnings calendar
    try {
      const earn = await fetchEarnings(d.ticker, at);
      setEarnings(earn);
    } catch { setEarnings(null); }
  }, []);

  const reset = () => {
    setResult(null); setAnalysis(null); setError(null);
    setBacktestStats(null); setWeeklySignal(null); setIndicatorReport(null); setEarnings(null);
  };

  const handleScreenerSelect = (card) => {
    if (card && !card.error) {
      handleResult(card, card.analysis, "US Stock");
    }
  };

  // Manual refresh
  const refresh = async () => {
    if (!result || refreshing) return;
    setRefreshing(true);
    try {
      const raw = await fetchCandleData(result.ticker, result.timeframe, assetType);
      const newCard = buildSignalCard(result.ticker, result.timeframe, raw);
      setResult(newCard);
      setAnalysis(newCard.analysis);

      // Backtest on extended data + adaptive re-score
      try {
        const btRaw = await fetchBacktestData(result.ticker, assetType);
        const bt = runBacktest(btRaw);
        setBacktestStats(bt.stats);
        setIndicatorReport(bt.indicatorReport);

        if (bt.adaptiveWeights) {
          const rescored = rescoreWithAdaptiveWeights(newCard, raw, bt.adaptiveWeights);
          setResult(rescored);
          setAnalysis(rescored.analysis);
        }
      } catch {
        setBacktestStats(null);
        setIndicatorReport(null);
      }

      if (result.timeframe !== "1W") {
        try {
          const weeklyRaw = await fetchCandleData(result.ticker, "1W", assetType);
          const weeklyCard = buildSignalCard(result.ticker, "1W", weeklyRaw);
          setWeeklySignal(weeklyCard.signal);
        } catch {
          setWeeklySignal(null);
        }
      }

      // Refresh earnings
      try {
        const earn = await fetchEarnings(result.ticker, assetType);
        setEarnings(earn);
      } catch {
        setEarnings(null);
      }

      // Check alerts on refresh
      const alerts = await checkAlerts();
      if (alerts.length) setTriggeredAlerts(prev => [...prev, ...alerts]);
    } catch (e) {
      setError(e.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const TabBtn = ({ id, label }) => (
    <button onClick={() => { setTab(id); reset(); }} style={{
      flex: 1, padding: "9px 0", borderRadius: 7, fontFamily: C.mono, fontSize: "0.62rem", letterSpacing: "0.1em", fontWeight: 700,
      background: tab === id ? "#0d2a18" : C.card,
      border: `1px solid ${tab === id ? C.green : C.border}`,
      color: tab === id ? C.green : C.dim, transition: "all 0.2s",
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 14px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <GlobalStyles />

      <div style={{ width: "100%", maxWidth: 560, marginBottom: 14 }}>
        {/* Alert notifications */}
        <AlertNotifications triggered={triggeredAlerts}
          onDismiss={(i) => setTriggeredAlerts(prev => prev.filter((_, j) => j !== i))} />

        {/* Top nav */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <button onClick={result ? reset : undefined} style={{
            background: "transparent", border: "none",
            color: result ? C.green : C.dim, fontFamily: C.raj, fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.08em", padding: 0,
          }}>
            {result ? `< ${result.ticker}` : "SIGNAL ANALYZER"}
          </button>
          {result && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={refresh} disabled={refreshing} style={{
                background: "#0d2a18", border: `1px solid ${C.green}`,
                color: C.green, padding: "5px 12px", borderRadius: 20, fontSize: "0.58rem", letterSpacing: "0.1em", fontWeight: 700,
              }}>
                {refreshing ? <Spinner size={10} /> : "REFRESH"}
              </button>
<button onClick={reset} style={{
                background: C.card, border: `1px solid ${C.border}`, color: C.dim,
                padding: "5px 12px", borderRadius: 20, fontSize: "0.58rem", letterSpacing: "0.1em",
              }}>NEW</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        {!result && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            <TabBtn id="analyze" label="ANALYZE" />
            <TabBtn id="screener" label="SCREENER" />
            <TabBtn id="portfolio" label="PORTFOLIO" />
            <TabBtn id="journal" label="JOURNAL" />
          </div>
        )}
      </div>

      <div className="app-container" style={{ width: "100%", maxWidth: 560 }}>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <ErrorBoundary resetKey={`${tab}:${result?.ticker || "none"}`} onReset={reset}>
          <Suspense fallback={<SectionFallback label="LOADING SCREEN" />}>
          {tab === "analyze" && !result && <AnalyzeScreen onResult={handleResult} onError={setError} />}
          {tab === "screener" && !result && <ScreenerScreen onSelectTicker={handleScreenerSelect} />}
          {tab === "portfolio" && !result && <PortfolioScreen />}
          {tab === "journal" && !result && <JournalScreen />}
          </Suspense>

          {result && (
            <div className="fade">
              <MTFBadge dailySignal={result.signal} weeklySignal={weeklySignal} />
              <Commentary analysis={analysis} signal={result.signal} />
              <AISummary analysis={analysis} signal={result.signal} />
              <BacktestCard stats={backtestStats} signal={result.signal} indicatorReport={indicatorReport} />
              <SignalHeader d={result} analysis={analysis} />
              <EarlyWarnings warnings={result.earlyWarnings || []} />
              <PatternBreakouts patterns={result.patterns || []} />
              <SignalCards d={result} />
              <Suspense fallback={<SectionFallback label="LOADING SIZER" />}>
                <PositionSizer d={result} />
              </Suspense>
              <OptionsPlay d={result} />
              <EarningsCard earnings={earnings} />
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <AlertSetButton ticker={result.ticker} assetType={assetType} />
                <QuickLogButton d={result} onLogged={() => {}} />
                <Suspense fallback={<SectionFallback label="LOADING VIDEO" />}>
                  <VideoExportButton type="signal" props={buildSignalVideoProps(result, analysis)} label="VIDEO" />
                </Suspense>
              </div>
              <AlertsList />
              <div style={{ textAlign: "center", color: "#182818", fontSize: "0.52rem", letterSpacing: "0.1em", fontFamily: C.mono, padding: "4px 0 20px" }}>
                FOR INFORMATIONAL PURPOSES ONLY - NOT FINANCIAL ADVICE
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
