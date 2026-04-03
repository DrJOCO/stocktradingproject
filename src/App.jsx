import { lazy, Suspense, useState, useCallback, useEffect } from "react";
import { GlobalStyles, C, ErrorBanner, Spinner, Chip } from "./components/ui.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { useAuth } from "./auth/AuthProvider.jsx";
import AnalyzeScreen from "./components/AnalyzeScreen.jsx";
import QuickLogButton from "./components/QuickLogButton.jsx";
import { ActionSignalCard, TradeNarrativeCard, EarlyWarnings, PatternBreakouts, SignalCards, OptionsPlay, BacktestCard, MTFBadge, EarningsCard, TickerHistoryCard, OTEReviewCard } from "./components/SignalResult.jsx";
import { AlertNotifications, AlertSetButton, AlertsList } from "./components/AlertsPanel.jsx";
import { buildSignalVideoProps } from "./components/videoExportProps.js";
import { fetchCandleData, fetchBacktestData, fetchEarnings } from "./api/finnhub.js";
import { buildSignalCard, rescoreWithAdaptiveWeights } from "./indicators/scoring.js";
import { runBacktest } from "./backtest/engine.js";
import { getOteReviewTimeframes, reviewOteTriggers } from "./indicators/oteReview.js";
import { checkAlerts } from "./utils/alerts.js";
import { addRecentAnalysis, getRecentAnalyses, subscribeStorage } from "./utils/storage.js";

const ScreenerScreen = lazy(() => import("./components/ScreenerScreen.jsx"));
const MorningBriefScreen = lazy(() => import("./components/MorningBriefScreen.jsx"));
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

function buildRecentAnalysisEntry(card, analysis, assetType) {
  return {
    ticker: card.ticker,
    timeframe: card.timeframe,
    assetType,
    signal: card.signal,
    score: card.score,
    confidence: card.confidence,
    entry: card.entry,
    stop: card.stop,
    target: card.target,
    adx: card.adx,
    vol: card.vol,
    heroLead: analysis?.heroLead || "",
    keyStrength: analysis?.keyStrength || "",
    keyRisk: analysis?.keyRisk || "",
    summary: analysis?.summary || "",
    analyzedAt: new Date().toISOString(),
  };
}

const RESULT_SECTIONS = [
  { id: "overview", label: "OVERVIEW" },
  { id: "plan", label: "TRADE PLAN" },
  { id: "evidence", label: "EVIDENCE" },
  { id: "history", label: "HISTORY" },
];

function buildOteReviewErrorState(timeframe, message) {
  return {
    selectedTimeframe: timeframe,
    timeframes: getOteReviewTimeframes(timeframe),
    reviewsByTimeframe: {},
    errorsByTimeframe: timeframe ? { [timeframe]: message || "OTE review unavailable." } : {},
  };
}

async function buildOteReviewState(ticker, timeframe, assetType, currentRaw = null) {
  const timeframes = getOteReviewTimeframes(timeframe);
  const requests = timeframes.map((frame) =>
    frame === timeframe && currentRaw
      ? Promise.resolve(currentRaw)
      : fetchCandleData(ticker, frame, assetType),
  );
  const settled = await Promise.allSettled(requests);
  const reviewsByTimeframe = {};
  const errorsByTimeframe = {};

  settled.forEach((result, index) => {
    const frame = timeframes[index];
    if (result.status === "fulfilled") {
      reviewsByTimeframe[frame] = { timeframe: frame, ...reviewOteTriggers(result.value) };
    } else {
      errorsByTimeframe[frame] = result.reason?.message || "OTE review unavailable.";
    }
  });

  return {
    selectedTimeframe: reviewsByTimeframe[timeframe] ? timeframe : timeframes[0] || timeframe,
    timeframes,
    reviewsByTimeframe,
    errorsByTimeframe,
  };
}

export default function App() {
  const { user, loading: authLoading, enabled: authEnabled, syncState, error: authError, dismissError, signIn, signOut } = useAuth();
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
  const [oteReview, setOteReview] = useState(null);
  const [storageVersion, setStorageVersion] = useState(0);
  const [recentAnalyses, setRecentAnalyses] = useState(() => getRecentAnalyses());
  const [resultSection, setResultSection] = useState("overview");

  useEffect(() => subscribeStorage(({ origin, keys }) => {
    if (origin === "cloud" || origin === "hydrate" || origin === "auth") {
      setStorageVersion((version) => version + 1);
    }
    if (origin === "cloud" || origin === "hydrate" || origin === "auth" || keys?.includes("recentAnalyses")) {
      setRecentAnalyses(getRecentAnalyses());
    }
  }), []);

  const setSelectedOteTimeframe = useCallback((timeframe) => {
    setOteReview((current) => {
      if (!current?.timeframes?.includes(timeframe)) return current;
      return { ...current, selectedTimeframe: timeframe };
    });
  }, []);

  const handleResult = useCallback(async (d, ai, at, liveRaw = null) => {
    setResult(d);
    setAnalysis(ai);
    setAssetType(at);
    setError(null);
    setResultSection("overview");
    let finalCard = d;
    let finalAnalysis = ai;
    let reviewRaw = liveRaw;

    try {
      reviewRaw = reviewRaw || await fetchCandleData(d.ticker, d.timeframe, at);
      setOteReview(await buildOteReviewState(d.ticker, d.timeframe, at, reviewRaw));
    } catch (reviewError) {
      setOteReview(buildOteReviewErrorState(d.timeframe, reviewError.message));
    }

    // Run backtest on extended data + learn adaptive weights
    try {
      const btRaw = await fetchBacktestData(d.ticker, at);
      const bt = runBacktest(btRaw);
      setBacktestStats(bt.stats);
      setIndicatorReport(bt.indicatorReport);

      // Re-score the signal using learned adaptive weights
      if (bt.adaptiveWeights && reviewRaw) {
        const rescored = rescoreWithAdaptiveWeights(d, reviewRaw, bt.adaptiveWeights);
        setResult(rescored);
        setAnalysis(rescored.analysis);
        finalCard = rescored;
        finalAnalysis = rescored.analysis;
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

    setRecentAnalyses(addRecentAnalysis(buildRecentAnalysisEntry(finalCard, finalAnalysis, at)));
  }, []);

  const reset = () => {
    setResult(null); setAnalysis(null); setError(null);
    setBacktestStats(null); setWeeklySignal(null); setIndicatorReport(null); setEarnings(null); setOteReview(null);
    setResultSection("overview");
  };

  const handleScreenerSelect = (card) => {
    if (card && !card.error) {
      handleResult(card, card.analysis, "US Stock");
    }
  };

  const handleOpenTicker = useCallback(async (ticker, timeframe, at) => {
    try {
      const raw = await fetchCandleData(ticker, timeframe, at);
      const signal = buildSignalCard(ticker, timeframe, raw);
      setTab("analyze");
      await handleResult(signal, signal.analysis, at, raw);
    } catch (openError) {
      setError(openError.message || "Failed to open ticker setup.");
    }
  }, [handleResult]);

  // Manual refresh
  const refresh = async () => {
    if (!result || refreshing) return;
    setRefreshing(true);
    try {
      const raw = await fetchCandleData(result.ticker, result.timeframe, assetType);
      const newCard = buildSignalCard(result.ticker, result.timeframe, raw);
      setResult(newCard);
      setAnalysis(newCard.analysis);
      setOteReview(await buildOteReviewState(result.ticker, result.timeframe, assetType, raw));
      let finalCard = newCard;
      let finalAnalysis = newCard.analysis;

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
          finalCard = rescored;
          finalAnalysis = rescored.analysis;
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

      setRecentAnalyses(addRecentAnalysis(buildRecentAnalysisEntry(finalCard, finalAnalysis, assetType)));
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

  const ResultSectionBtn = ({ id, label }) => (
    <button
      onClick={() => setResultSection(id)}
      style={{
        flex: 1,
        padding: "9px 10px",
        borderRadius: 7,
        fontFamily: C.mono,
        fontSize: "0.58rem",
        letterSpacing: "0.1em",
        fontWeight: 700,
        background: resultSection === id ? "#0d2a18" : C.card,
        border: `1px solid ${resultSection === id ? C.green : C.border}`,
        color: resultSection === id ? C.green : C.dim,
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );

  const renderResultSection = () => {
    switch (resultSection) {
      case "overview":
        return (
          <>
            <TradeNarrativeCard analysis={analysis} signal={result.signal} />
            <MTFBadge dailySignal={result.signal} weeklySignal={weeklySignal} />
          </>
        );
      case "plan":
        return (
          <>
            <OTEReviewCard reviewState={oteReview} onSelectTimeframe={setSelectedOteTimeframe} />
            <Suspense fallback={<SectionFallback label="LOADING SIZER" />}>
              <PositionSizer key={`position:${storageVersion}`} d={result} />
            </Suspense>
            <OptionsPlay d={result} />
            <EarningsCard earnings={earnings} />
            <AlertsList key={`alerts:${storageVersion}`} />
          </>
        );
      case "evidence":
        return (
          <>
            <EarlyWarnings warnings={result.earlyWarnings || []} />
            <PatternBreakouts patterns={result.patterns || []} />
            <SignalCards d={result} />
          </>
        );
      case "history":
        return (
          <>
            <BacktestCard stats={backtestStats} signal={result.signal} indicatorReport={indicatorReport} />
            <TickerHistoryCard entries={recentAnalyses.filter((entry) => entry.ticker === result.ticker).slice(0, 6)} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "20px 14px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <GlobalStyles />

      <div style={{ width: "100%", maxWidth: 560, marginBottom: 14 }}>
        {/* Alert notifications */}
        <AlertNotifications triggered={triggeredAlerts}
          onDismiss={(i) => setTriggeredAlerts(prev => prev.filter((_, j) => j !== i))} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Chip
              label={authEnabled ? syncState : "LOCAL ONLY"}
              color={authEnabled ? (user ? C.cyan : C.yellow) : C.dim}
              bg={authEnabled ? "#051414" : "#101610"}
              bd={authEnabled ? `${C.cyan}35` : C.border}
            />
            {user && (
              <span style={{ color: C.mid, fontSize: "0.58rem", fontFamily: C.mono }}>
                {user.displayName || user.email}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {authEnabled ? (
              user ? (
                <button
                  onClick={signOut}
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.border}`,
                    color: C.dim,
                    borderRadius: 20,
                    padding: "5px 12px",
                    fontSize: "0.58rem",
                    letterSpacing: "0.1em",
                  }}
                >
                  SIGN OUT
                </button>
              ) : (
                <button
                  onClick={signIn}
                  disabled={authLoading}
                  style={{
                    background: "#0d2a18",
                    border: `1px solid ${C.green}`,
                    color: C.green,
                    borderRadius: 20,
                    padding: "5px 12px",
                    fontSize: "0.58rem",
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                  }}
                >
                  {authLoading ? "CONNECTING" : "SIGN IN TO SYNC"}
                </button>
              )
            ) : (
              <span style={{ color: C.dim, fontSize: "0.56rem", fontFamily: C.mono }}>
                Add Firebase env vars to enable cross-device sync
              </span>
            )}
          </div>
        </div>

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
            <TabBtn id="brief" label="BRIEF" />
            <TabBtn id="screener" label="SCREENER" />
            <TabBtn id="portfolio" label="PORTFOLIO" />
            <TabBtn id="journal" label="JOURNAL" />
          </div>
        )}
      </div>

      <div className="app-container" style={{ width: "100%", maxWidth: 560 }}>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <ErrorBanner message={authError} onDismiss={dismissError} />

        <ErrorBoundary resetKey={`${tab}:${result?.ticker || "none"}`} onReset={reset}>
          <Suspense fallback={<SectionFallback label="LOADING SCREEN" />}>
          {tab === "analyze" && !result && <AnalyzeScreen onResult={handleResult} onError={setError} recentAnalyses={recentAnalyses} />}
          {tab === "brief" && !result && <MorningBriefScreen onOpenTicker={handleOpenTicker} />}
          {tab === "screener" && !result && <ScreenerScreen key={`screener:${storageVersion}`} onSelectTicker={handleScreenerSelect} />}
          {tab === "portfolio" && !result && <PortfolioScreen />}
          {tab === "journal" && !result && <JournalScreen key={`journal:${storageVersion}`} />}
          </Suspense>

          {result && (
            <div className="fade">
              <ActionSignalCard d={result} analysis={analysis} />
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <AlertSetButton key={`alert-set:${result.ticker}:${storageVersion}`} ticker={result.ticker} assetType={assetType} />
                <QuickLogButton d={result} onLogged={() => {}} />
                <Suspense fallback={<SectionFallback label="LOADING VIDEO" />}>
                  <VideoExportButton type="signal" props={buildSignalVideoProps(result, analysis)} label="VIDEO FOR X" />
                </Suspense>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
                {RESULT_SECTIONS.map((section) => (
                  <ResultSectionBtn key={section.id} id={section.id} label={section.label} />
                ))}
              </div>
              {renderResultSection()}
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
