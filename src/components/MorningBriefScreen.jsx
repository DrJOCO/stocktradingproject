import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { C, Card, Chip, SecHead, Spinner, UI, inputStyle, selectStyle, primaryButtonStyle } from "./ui.jsx";
import { buildLeaderboardVideoProps } from "./videoExportProps.js";
import { BUILTIN_BRIEF_WATCHLISTS, runMorningBrief } from "../lib/morningBrief.js";
import { getMorningBriefState, saveMorningBriefState } from "../utils/storage.js";

const SORT_OPTIONS = [
  { id: "score", label: "BEST SCORE" },
  { id: "confidence", label: "BEST CONF" },
  { id: "rsi", label: "LOW RSI" },
  { id: "volume", label: "HIGH VOL" },
  { id: "mtf", label: "MTF ALIGN" },
];

const TIMEFRAME_OPTIONS = ["1H", "4H", "1D", "1W"];
const CONFIRM_OPTIONS = ["OFF", "AUTO", "1H", "4H", "1D", "1W"];

const VideoExportButton = lazy(() =>
  import("./VideoExport.jsx").then((module) => ({ default: module.VideoExportButton })),
);

function LazyInlineFallback({ label = "LOADING" }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>
      <Spinner size={10} />
      <span>{label}</span>
    </div>
  );
}

function compactBriefCard(card) {
  return {
    ticker: card.ticker,
    timeframe: card.timeframe,
    assetType: card.assetType,
    signal: card.signal,
    score: card.score,
    confidence: card.confidence,
    entry: card.entry,
    stop: card.stop,
    target: card.target,
    mtf: card.mtf,
    analysis: {
      heroLead: card.analysis?.heroLead || "",
      suggestion: card.analysis?.suggestion || "",
      summary: card.analysis?.summary || "",
    },
  };
}

function CopyBlock({ title, value, buttonLabel = "COPY" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <Card style={{ padding: 12 }}>
      <SecHead left={title} right={`${value.length} CHARS`} />
      <div style={{
        background: "#081008",
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: "12px 12px",
        color: C.light,
        fontSize: "0.6rem",
        fontFamily: C.mono,
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
        marginBottom: 10,
      }}>
        {value}
      </div>
      <button
        onClick={handleCopy}
        style={primaryButtonStyle(true, { padding: "10px 0", fontSize: "0.64rem" })}
      >
        {copied ? "COPIED" : buttonLabel}
      </button>
    </Card>
  );
}

export default function MorningBriefScreen({ onOpenTicker }) {
  const persisted = useMemo(() => getMorningBriefState(), []);
  const [source, setSource] = useState(persisted.source || "Mega Cap Tech");
  const [customTickers, setCustomTickers] = useState(persisted.customTickers || "");
  const [timeframe, setTimeframe] = useState(persisted.timeframe || "1D");
  const [confirmMode, setConfirmMode] = useState(persisted.confirmMode || "AUTO");
  const [sortBy, setSortBy] = useState(persisted.sortBy || "score");
  const [topCount, setTopCount] = useState(persisted.topCount || 3);
  const [limit, setLimit] = useState(persisted.limit || 10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, ticker: "" });
  const [brief, setBrief] = useState(persisted);

  useEffect(() => {
    saveMorningBriefState({
      ...brief,
      source,
      customTickers,
      timeframe,
      confirmMode,
      sortBy,
      topCount,
      limit,
    });
  }, [brief, source, customTickers, timeframe, confirmMode, sortBy, topCount, limit]);

  const runBrief = async () => {
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: 0, ticker: "" });

    try {
      const next = await runMorningBrief({
        source,
        customTickers,
        timeframe,
        confirmMode,
        sortBy,
        topCount,
        limit,
        onProgress: setProgress,
      });

      const persistedBrief = {
        ...next,
        results: next.results.map(compactBriefCard),
        topResults: next.topResults.map(compactBriefCard),
        failures: next.failures.map((failure) => ({ ticker: failure.ticker, error: failure.error })),
      };
      setBrief(persistedBrief);
    } catch (runError) {
      setError(runError.message || "Morning brief failed.");
    } finally {
      setLoading(false);
    }
  };

  const canRun = loading ? false : !!customTickers.trim() || !!BUILTIN_BRIEF_WATCHLISTS[source];

  return (
    <div className="fade" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card>
        <SecHead left="MORNING BRIEF" right="DAILY PLAN" />
        <div style={{ color: C.mid, fontSize: "0.6rem", fontFamily: C.mono, lineHeight: 1.7, marginBottom: 12 }}>
          Run the same morning workflow every day: scan a focused universe, rank the best setups, draft X posts, and tap into the full setup review for the top names.
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {Object.keys(BUILTIN_BRIEF_WATCHLISTS).map((label) => (
            <button
              key={label}
              onClick={() => { setSource(label); setCustomTickers(""); }}
              style={{
                background: source === label && !customTickers.trim() ? "#0d2a18" : "#081008",
                border: `1px solid ${source === label && !customTickers.trim() ? C.green : C.border}`,
                color: source === label && !customTickers.trim() ? C.green : C.mid,
                borderRadius: 5,
                padding: "6px 10px",
                fontSize: "0.58rem",
                fontFamily: C.mono,
                letterSpacing: "0.08em",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ ...UI.field, marginBottom: 10 }}>
          <label style={UI.label}>CUSTOM TICKERS (OPTIONAL, COMMA SEPARATED)</label>
          <input
            value={customTickers}
            onChange={(event) => setCustomTickers(event.target.value.toUpperCase())}
            placeholder="AAPL, MSFT, NVDA"
            style={inputStyle()}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
          <div style={UI.field}>
            <label style={UI.label}>TIMEFRAME</label>
            <select value={timeframe} onChange={(event) => setTimeframe(event.target.value)} style={selectStyle()}>
              {TIMEFRAME_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div style={UI.field}>
            <label style={UI.label}>MTF CONFIRM</label>
            <select value={confirmMode} onChange={(event) => setConfirmMode(event.target.value)} style={selectStyle()}>
              {CONFIRM_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div style={UI.field}>
            <label style={UI.label}>SORT BY</label>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={selectStyle()}>
              {SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          <div style={UI.field}>
            <label style={UI.label}>TOP SETUPS</label>
            <input type="number" min="1" max="5" value={topCount} onChange={(event) => setTopCount(Math.max(1, Math.min(5, Number(event.target.value) || 3)))} style={inputStyle()} />
          </div>
          <div style={UI.field}>
            <label style={UI.label}>RESULT LIMIT</label>
            <input type="number" min="3" max="20" value={limit} onChange={(event) => setLimit(Math.max(3, Math.min(20, Number(event.target.value) || 10)))} style={inputStyle()} />
          </div>
        </div>

        <button onClick={runBrief} disabled={!canRun} style={primaryButtonStyle(canRun, { marginBottom: loading ? 10 : 0 })}>
          {loading ? `RUNNING ${progress.done}/${progress.total || "?"}${progress.ticker ? ` · ${progress.ticker}` : ""}` : "RUN MORNING BRIEF"}
        </button>
      </Card>

      {error && (
        <Card style={{ border: `1px solid ${C.red}40`, background: "#140808" }}>
          <SecHead left="BRIEF ERROR" />
          <div style={{ color: C.red, fontSize: "0.6rem", fontFamily: C.mono, lineHeight: 1.6 }}>{error}</div>
        </Card>
      )}

      {brief?.runTime && (
        <>
          <Card>
            <SecHead left="LATEST BRIEF" right={new Date(brief.runTime).toLocaleString()} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Chip label={brief.sourceLabel || source} color={C.green} bg="#0b2214" bd={`${C.green}40`} />
              <Chip label={`${brief.timeframe}${brief.confirmTimeframe ? `/${brief.confirmTimeframe}` : ""}`} color={C.cyan} bg="#051414" bd={`${C.cyan}35`} />
              <Chip label={`SCANNED ${brief.scannedCount || 0}`} color={C.yellow} bg="#191400" bd="#504400" />
              <Chip label={`RANKED ${brief.results?.length || 0}`} color={C.light} bg="#101610" bd={C.border} />
              {brief.failures?.length ? <Chip label={`FAIL ${brief.failures.length}`} color={C.red} bg="#180808" bd={`${C.red}40`} /> : null}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <Suspense fallback={<LazyInlineFallback label="LOADING VIDEO" />}>
                <VideoExportButton type="leaderboard" props={buildLeaderboardVideoProps(brief.results || [], brief.runTime ? new Date(brief.runTime) : null)} label="VIDEO FOR X" />
              </Suspense>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(brief.topResults || []).map((card, index) => (
                <div key={`${card.ticker}:${index}`} style={{ background: "#081008", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ color: C.light, fontFamily: C.raj, fontSize: "1rem", fontWeight: 700 }}>{index + 1}. {card.ticker}</span>
                        <Chip label={card.signal} color={card.signal?.includes("LONG") ? C.green : card.signal?.includes("SHORT") ? C.red : C.yellow} />
                        {card.mtf?.status && card.mtf.status !== "OFF" ? <Chip label={card.mtf.status} color={card.mtf.status === "ALIGNED" ? C.green : card.mtf.status === "CONFLICT" ? C.red : C.yellow} /> : null}
                      </div>
                      <div style={{ color: C.mid, fontSize: "0.58rem", fontFamily: C.mono, lineHeight: 1.6 }}>
                        {card.analysis?.heroLead || card.analysis?.summary || "No narrative generated."}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 88 }}>
                      <div style={{ color: C.light, fontFamily: C.raj, fontWeight: 700, fontSize: "1rem" }}>S{card.score}</div>
                      <div style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono }}>{card.confidence}% conf</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
                    {[
                      { label: "ENTRY", value: `$${card.entry}` },
                      { label: "STOP", value: `$${card.stop}` },
                      { label: "TARGET", value: `$${card.target}` },
                    ].map((metric) => (
                      <div key={metric.label} style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 8px" }}>
                        <div style={{ color: C.dim, fontSize: "0.48rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 3 }}>{metric.label}</div>
                        <div style={{ color: C.light, fontSize: "0.75rem", fontFamily: C.mono }}>{metric.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono, lineHeight: 1.5 }}>
                      {card.analysis?.suggestion || "Open the full setup to review the trade plan."}
                    </div>
                    <button
                      onClick={() => onOpenTicker?.(card.ticker, card.timeframe, card.assetType || "US Stock")}
                      style={{
                        background: "#0d2a18",
                        border: `1px solid ${C.green}`,
                        color: C.green,
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: "0.56rem",
                        fontFamily: C.mono,
                        letterSpacing: "0.08em",
                        fontWeight: 700,
                      }}
                    >
                      OPEN FULL SETUP
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <CopyBlock title="X DRAFT · SCREEN SUMMARY" value={brief.summaryPost || ""} buttonLabel="COPY SUMMARY POST" />
          <CopyBlock title="X DRAFT · THREAD STARTER" value={brief.threadStarter || ""} buttonLabel="COPY THREAD STARTER" />

          {!!brief.replyDrafts?.length && (
            <Card>
              <SecHead left="X DRAFT · REPLIES" right={`${brief.replyDrafts.length} POSTS`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {brief.replyDrafts.map((reply, index) => (
                  <CopyBlock key={index} title={`REPLY ${index + 1}`} value={reply} buttonLabel={`COPY REPLY ${index + 1}`} />
                ))}
              </div>
            </Card>
          )}

          {!!brief.failures?.length && (
            <Card>
              <SecHead left="FETCH FAILURES" right={`${brief.failures.length} TICKERS`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {brief.failures.map((failure) => (
                  <div key={failure.ticker} style={{ background: "#140808", border: `1px solid ${C.red}30`, borderRadius: 7, padding: "9px 10px" }}>
                    <div style={{ color: C.red, fontSize: "0.58rem", fontFamily: C.mono }}>{failure.ticker}</div>
                    <div style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, marginTop: 4 }}>{failure.error}</div>
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
