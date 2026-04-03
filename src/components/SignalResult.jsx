import { C, Card, Chip, SecHead, MetricBox, TagRow } from "./ui.jsx";
import { SIGNALS } from "../indicators/scoring.js";
import { ADAPTIVE_INDICATOR_LABELS } from "../indicators/scoreConfig.js";

// --- Commentary Banner (like the screenshot) ---
export function Commentary({ analysis, signal }) {
  if (!analysis?.commentary) return null;
  const meta = SIGNALS[signal] || SIGNALS["NEUTRAL"];
  const title = analysis.contextTitle || "TRADE NARRATIVE";
  const body = analysis.contextBody || analysis.commentary;
  return (
    <div style={{
      background: "#081008",
      border: `1px solid ${meta.color}25`,
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 10,
      boxShadow: `inset 3px 0 0 ${meta.color}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ color: meta.color, fontSize: "0.8rem", lineHeight: 1 }}>⚡</span>
        <span style={{ color: C.light, fontSize: "0.63rem", fontWeight: 800, letterSpacing: "0.06em", fontFamily: C.mono }}>{title.toUpperCase()}</span>
      </div>
      <p style={{ color: C.light, fontSize: "0.66rem", fontFamily: C.mono, lineHeight: 1.7, margin: 0 }}>
        {body}
      </p>
    </div>
  );
}

// --- Signal Summary ---
export function AISummary({ analysis, signal }) {
  if (!analysis) return null;
  const meta = SIGNALS[signal] || SIGNALS["NEUTRAL"];
  const cc = analysis.conviction === "HIGH" ? C.green : analysis.conviction === "MEDIUM" ? C.yellow : C.red;

  return (
    <Card style={{ border: `1px solid ${meta.color}30`, background: "#0c150c" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: C.cyan, fontSize: "0.6rem", letterSpacing: "0.12em", fontFamily: C.mono }}>SIGNAL SUMMARY</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {analysis.ivEnvironment && (
            <Chip label={`IV ${analysis.ivEnvironment}`}
              color={analysis.ivEnvironment === "HIGH" ? C.orange : analysis.ivEnvironment === "LOW" ? C.cyan : C.mid}
              bg={analysis.ivEnvironment === "HIGH" ? "#1a0d00" : "#001414"} />
          )}
          <Chip label={`${analysis.conviction} CONVICTION`} color={cc} bg={cc + "18"} bd={cc + "40"} />
        </div>
      </div>
      <p style={{ color: C.light, fontSize: "0.67rem", fontFamily: C.mono, lineHeight: 1.75, marginBottom: 12 }}>
        {analysis.summary}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 10 }}>
        <div style={{ background: "#091409", border: `1px solid ${C.green}25`, borderRadius: 6, padding: "8px 10px" }}>
          <div style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", marginBottom: 3, fontFamily: C.mono }}>KEY STRENGTH</div>
          <div style={{ color: C.green, fontSize: "0.63rem", fontFamily: C.mono, lineHeight: 1.5 }}>{analysis.keyStrength}</div>
        </div>
        <div style={{ background: "#140909", border: `1px solid ${C.red}25`, borderRadius: 6, padding: "8px 10px" }}>
          <div style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", marginBottom: 3, fontFamily: C.mono }}>KEY RISK</div>
          <div style={{ color: C.red, fontSize: "0.63rem", fontFamily: C.mono, lineHeight: 1.5 }}>{analysis.keyRisk}</div>
        </div>
      </div>
      {analysis.ivNote && (
        <div style={{ background: "#06090a", border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 11px", marginBottom: 8 }}>
          <span style={{ color: C.orange, fontSize: "0.55rem", fontWeight: 700, fontFamily: C.mono }}>IV ENVIRONMENT: </span>
          <span style={{ color: C.mid, fontSize: "0.57rem", fontFamily: C.mono }}>{analysis.ivNote}</span>
        </div>
      )}
      <div style={{ background: "#0c180c", border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 12px" }}>
        <span style={{ color: C.yellow, fontSize: "0.57rem", fontWeight: 700, letterSpacing: "0.1em", fontFamily: C.mono }}>SUGGESTION: </span>
        <span style={{ color: C.mid, fontSize: "0.63rem", fontFamily: C.mono }}>{analysis.suggestion}</span>
      </div>
    </Card>
  );
}

// --- Backtest Results Card ---
export function BacktestCard({ stats, signal, indicatorReport }) {
  if (!stats) return null;
  const isLong = signal?.includes("LONG");
  const isShort = signal?.includes("SHORT");
  const pfc = stats.profitFactor >= 1.5 ? C.green : stats.profitFactor >= 1.0 ? C.yellow : C.red;

  // Relevant win rate for current direction
  const dirWinRate = isLong ? stats.longWinRate : isShort ? stats.shortWinRate : stats.winRate;
  const dirCount = isLong ? stats.longCount : isShort ? stats.shortCount : stats.totalTrades;
  const dirGood = dirWinRate >= 50;

  // Plain English verdict
  let verdict, verdictColor, verdictBg;
  if (dirWinRate >= 60) {
    verdict = `Backtesting confirms this ${isLong ? "long" : isShort ? "short" : ""} signal. The scoring system has a ${dirWinRate}% win rate on ${dirCount} historical ${isLong ? "long" : isShort ? "short" : ""} trades for this ticker. Trade with confidence at normal size.`;
    verdictColor = C.green; verdictBg = "#091409";
  } else if (dirWinRate >= 45) {
    verdict = `Backtesting is borderline for ${isLong ? "longs" : isShort ? "shorts" : "this direction"} — ${dirWinRate}% win rate on ${dirCount} trades. The signal may be right but the edge is thin. Consider smaller position size.`;
    verdictColor = C.yellow; verdictBg = "#140d00";
  } else {
    verdict = `Backtesting does NOT support this ${isLong ? "long" : isShort ? "short" : ""} signal — only ${dirWinRate}% win rate on ${dirCount} historical trades. The indicators say ${signal} right now, but historically this system hasn't been accurate on this ticker in this direction. Either skip this trade or size down significantly.`;
    verdictColor = C.red; verdictBg = "#140808";
  }

  return (
    <Card style={{ border: `1px solid ${dirGood ? C.green : verdictColor}25` }}>
      <SecHead left="BACKTEST — SHOULD YOU TRUST THIS SIGNAL?" right={`${stats.totalTrades} TRADES · 2YR`} />

      {/* Plain English verdict first */}
      <div style={{ background: verdictBg, border: `1px solid ${verdictColor}30`, borderRadius: 7, padding: "12px 14px", marginBottom: 14 }}>
        <p style={{ color: C.light, fontSize: "0.65rem", fontFamily: C.mono, lineHeight: 1.7, margin: 0 }}>
          {verdict}
        </p>
      </div>

      {/* Direction-specific win rate highlighted */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "#090f09", border: `1px solid ${dirGood ? C.green : C.red}30`, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ color: C.dim, fontSize: "0.5rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 4 }}>
            {isLong ? "LONG" : isShort ? "SHORT" : "OVERALL"} WIN RATE
          </div>
          <div style={{ color: dirGood ? C.green : C.red, fontSize: "1.3rem", fontWeight: 800, fontFamily: C.mono }}>{dirWinRate}%</div>
          <div style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono }}>{dirCount} trades</div>
        </div>
        <div style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
          <div style={{ color: C.dim, fontSize: "0.5rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 4 }}>PROFIT FACTOR</div>
          <div style={{ color: pfc, fontSize: "1.3rem", fontWeight: 800, fontFamily: C.mono }}>{stats.profitFactor}</div>
          <div style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono }}>{stats.profitFactor >= 1.5 ? "strong edge" : stats.profitFactor >= 1.0 ? "breakeven" : "negative edge"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
        <MetricBox label="AVG WIN" value={`+${stats.avgWin}%`} color={C.green} />
        <MetricBox label="AVG LOSS" value={`-${stats.avgLoss}%`} color={C.red} />
        <MetricBox label="MAX DD" value={`-${stats.maxDrawdown}%`} color={C.red} />
        <MetricBox label="AVG BARS" value={stats.avgBarsHeld} color={C.mid} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: indicatorReport ? 12 : 0 }}>
        <Chip label={`LONG ${stats.longWinRate}% (${stats.longCount})`} color={stats.longWinRate >= 50 ? C.green : C.red} />
        <Chip label={`SHORT ${stats.shortWinRate}% (${stats.shortCount})`} color={stats.shortWinRate >= 50 ? C.green : C.red} />
        <Chip label={`TGT ${stats.targets}`} color={C.green} bg="#0b2214" />
        <Chip label={`STP ${stats.stops}`} color={C.red} bg="#1a0808" />
        <Chip label={`TMO ${stats.timeouts}`} color={C.yellow} bg="#191400" />
      </div>

      {/* Indicator Reliability Report */}
      {indicatorReport && (
        <div style={{ marginTop: 4 }}>
          <SecHead left="WHAT ACTUALLY WORKS ON THIS TICKER" right="LEARNED FROM BACKTEST" />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(indicatorReport)
              .sort((a, b) => b[1].combinedEdge - a[1].combinedEdge)
              .map(([name, r]) => {
                const vc = r.verdict === "STRONG PREDICTOR" ? C.green :
                           r.verdict === "USEFUL" ? "#4ade80" :
                           r.verdict === "NEUTRAL" ? C.dim :
                           r.verdict === "WEAK" ? C.orange : C.red;
                const label = ADAPTIVE_INDICATOR_LABELS[name] || name;
                const barW = Math.max(5, Math.min(100, 50 + r.combinedEdge * 2));
                return (
                  <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.mid, fontSize: "0.58rem", fontFamily: C.mono, minWidth: 70 }}>{label}</span>
                    <div style={{ flex: 1, background: "#090f09", borderRadius: 2, height: 6, overflow: "hidden" }}>
                      <div style={{ background: vc, width: `${barW}%`, height: "100%", borderRadius: 2 }} />
                    </div>
                    <span style={{ color: vc, fontSize: "0.53rem", fontFamily: C.mono, minWidth: 50, textAlign: "right" }}>
                      {r.combinedEdge > 0 ? "+" : ""}{r.combinedEdge}%
                    </span>
                    <Chip label={r.verdict} color={vc} bg={vc + "15"} bd={vc + "30"} />
                    <span style={{ color: C.dim, fontSize: "0.48rem", fontFamily: C.mono }}>
                      {r.defaultWeight} → {r.adaptiveWeight}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </Card>
  );
}

// --- Multi-Timeframe Badge ---
export function MTFBadge({ dailySignal, weeklySignal }) {
  if (!weeklySignal) return null;
  const agree = (dailySignal.includes("LONG") && weeklySignal.includes("LONG")) ||
                (dailySignal.includes("SHORT") && weeklySignal.includes("SHORT"));
  const color = agree ? C.green : C.red;
  return (
    <div style={{
      background: color + "0a", border: `1px solid ${color}30`, borderRadius: 6,
      padding: "8px 12px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color, fontSize: "0.65rem", fontWeight: 700, fontFamily: C.mono }}>
          {agree ? "MTF CONFIRMED" : "MTF CONFLICT"}
        </span>
        <span style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>
          Daily: {dailySignal} | Weekly: {weeklySignal}
        </span>
      </div>
      <Chip label={agree ? "ALIGNED" : "DIVERGENT"} color={color} bg={color + "18"} bd={color + "40"} />
    </div>
  );
}

export function TickerHistoryCard({ entries = [] }) {
  if (!entries.length) return null;

  const latest = entries[0];
  const previous = entries[1] || null;
  const scoreDelta = previous ? latest.score - previous.score : null;
  const confidenceDelta = previous ? latest.confidence - previous.confidence : null;
  const signalFlip = previous && latest.signal !== previous.signal;

  return (
    <Card>
      <SecHead left="RECENT TICKER HISTORY" right={`${entries.length} SNAPSHOTS`} />
      {(scoreDelta !== null || confidenceDelta !== null || signalFlip) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {scoreDelta !== null && (
            <Chip
              label={`SCORE ${scoreDelta >= 0 ? "+" : ""}${scoreDelta}`}
              color={scoreDelta >= 0 ? C.green : C.red}
              bg={scoreDelta >= 0 ? "#0b2214" : "#1a0808"}
              bd={`${scoreDelta >= 0 ? C.green : C.red}40`}
            />
          )}
          {confidenceDelta !== null && (
            <Chip
              label={`CONF ${confidenceDelta >= 0 ? "+" : ""}${confidenceDelta}`}
              color={confidenceDelta >= 0 ? C.green : C.red}
              bg={confidenceDelta >= 0 ? "#0b2214" : "#1a0808"}
              bd={`${confidenceDelta >= 0 ? C.green : C.red}40`}
            />
          )}
          {signalFlip && <Chip label="SIGNAL FLIP" color={C.yellow} bg="#191400" bd="#504400" />}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.slice(0, 5).map((entry) => {
          const meta = SIGNALS[entry.signal] || SIGNALS.NEUTRAL;
          return (
            <div key={entry.id} style={{ background: "#081008", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: C.light, fontSize: "0.7rem", fontWeight: 700, fontFamily: C.raj }}>{entry.timeframe}</span>
                  <Chip label={entry.signal} color={meta.color} bg={meta.color + "18"} bd={meta.color + "40"} />
                </div>
                <span style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono }}>
                  {new Date(entry.analyzedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6, marginBottom: 6 }}>
                <div style={{ color: C.dim, fontSize: "0.53rem", fontFamily: C.mono }}>Score <span style={{ color: C.light }}>{entry.score}</span></div>
                <div style={{ color: C.dim, fontSize: "0.53rem", fontFamily: C.mono }}>Conf <span style={{ color: C.light }}>{entry.confidence}%</span></div>
                <div style={{ color: C.dim, fontSize: "0.53rem", fontFamily: C.mono }}>Entry <span style={{ color: C.light }}>${entry.entry}</span></div>
              </div>
              <div style={{ color: C.mid, fontSize: "0.58rem", fontFamily: C.mono, lineHeight: 1.55 }}>
                {entry.heroLead || entry.keyStrength || entry.summary || "Recent signal snapshot."}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function OTEReviewCard({ reviewState, onSelectTimeframe }) {
  if (!reviewState) return null;

  const formatReviewDate = (value, options) => {
    if (!value) return "—";
    return new Date(value).toLocaleDateString([], options);
  };

  const selectedTimeframe = reviewState.selectedTimeframe || reviewState.timeframes?.[0] || "1D";
  const activeReview = reviewState.reviewsByTimeframe?.[selectedTimeframe] || null;
  const activeError = reviewState.errorsByTimeframe?.[selectedTimeframe] || null;
  const latestTouch = activeReview?.latest;
  const latest = activeReview?.latestTriggered || latestTouch || null;
  const aggregate = activeReview?.aggregate;
  const overview = activeReview?.overview;
  const replayReviews = (activeReview?.reviews || []).filter((review) => review.entryPrice != null).slice(0, 4);
  const replayScale = replayReviews.length
    ? Math.max(
        1,
        ...replayReviews.map((review) => Math.max(
          Math.abs(review.outcome?.maxAdversePct ?? 0),
          Math.abs(review.outcome?.maxFavorablePct ?? 0),
          Math.abs(review.bestRuleExit?.pnlPct ?? 0),
        )),
      )
    : 1;
  const linePct = (value) => `${50 + ((value || 0) / replayScale) * 50}%`;
  const spanPct = (value) => `${Math.min(50, (Math.abs(value || 0) / replayScale) * 50)}%`;
  const outcomeColor = latest?.outcome?.targetHit
    ? C.green
    : latest?.outcome?.stopHit
    ? C.red
    : C.yellow;

  return (
    <Card>
      <SecHead left="OTE TRIGGER REVIEW" right={`${selectedTimeframe} · ${latest?.entryDate ? "POST-TRIGGER AUDIT" : latest ? "ZONE RETEST" : "TIMEFRAME REVIEW"}`} />

      {reviewState.timeframes?.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {reviewState.timeframes.map((timeframe) => {
            const timeframeReview = reviewState.reviewsByTimeframe?.[timeframe];
            const timeframeError = reviewState.errorsByTimeframe?.[timeframe];
            const active = timeframe === selectedTimeframe;
            return (
              <button
                key={timeframe}
                onClick={() => onSelectTimeframe?.(timeframe)}
                style={{
                  background: active ? "#0d2a18" : "#081008",
                  border: `1px solid ${active ? C.green : C.border}`,
                  borderRadius: 7,
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: active ? C.green : C.mid,
                  minHeight: 0,
                }}
              >
                <span style={{ fontSize: "0.62rem", fontFamily: C.mono, fontWeight: 700 }}>{timeframe}</span>
                <span style={{ color: active ? C.light : C.dim, fontSize: "0.5rem", fontFamily: C.mono }}>
                  {timeframeError
                    ? "unavailable"
                    : timeframeReview?.overview
                    ? `${timeframeReview.overview.triggerRate}% trig`
                    : "no reviews"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!latest && (
        <div style={{ background: "#081008", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ color: activeError ? C.red : C.yellow, fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", fontFamily: C.mono, marginBottom: 5 }}>
            {activeError ? "REVIEW UNAVAILABLE" : "NO VALID OTE REVIEWS FOUND"}
          </div>
          <div style={{ color: C.mid, fontSize: "0.6rem", fontFamily: C.mono, lineHeight: 1.6 }}>
            {activeError || `No valid structure-break retest into OTE was detected in the loaded ${selectedTimeframe} history.`}
          </div>
        </div>
      )}

      {latest && (
        <>
          {overview && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Chip label={`TOUCHES ${overview.zoneTouches}`} color={C.cyan} bg="#051414" bd={`${C.cyan}35`} />
              <Chip label={`TRIGGERS ${overview.triggeredEntries}`} color={C.green} bg="#0b2214" bd={`${C.green}40`} />
              <Chip label={`TRIGGER RATE ${overview.triggerRate}%`} color={overview.triggerRate >= 50 ? C.green : C.yellow} bg="#101610" bd={C.border} />
              <Chip label={`TARGET ${overview.targetRate}%`} color={C.green} bg="#0b2214" bd={`${C.green}40`} />
              <Chip label={`FAIL ${overview.failureRate}%`} color={C.red} bg="#1a0808" bd={`${C.red}40`} />
            </div>
          )}
          <div style={{ background: "#081008", border: `1px solid ${outcomeColor}25`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Chip label={`${latest.direction} OTE`} color={latest.direction === "LONG" ? C.green : C.red} />
                {latest.entryDate ? (
                  <Chip label="ENTRY TRIGGERED" color={outcomeColor} bg={outcomeColor + "18"} bd={outcomeColor + "40"} />
                ) : (
                  <Chip label="ZONE TOUCHED / NO TRIGGER" color={C.yellow} bg="#191400" bd="#504400" />
                )}
                {latest.triggerQuality ? (
                  <Chip label={`QUALITY ${latest.triggerQuality}`} color={latest.triggerQuality >= 70 ? C.green : latest.triggerQuality >= 55 ? C.yellow : C.red} bg="#101610" bd={C.border} />
                ) : null}
              </div>
              <span style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>
                {formatReviewDate(latest.entryDate || latest.zoneDate, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <p style={{ color: C.light, fontSize: "0.62rem", fontFamily: C.mono, lineHeight: 1.65, margin: 0 }}>
              {latest.narrative}
            </p>
            {latest.triggerConfirmationCount > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: C.dim, fontSize: "0.52rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 5 }}>TRIGGER STACK</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
                  <Chip label={latest.triggerCandle || "Confirmation candle"} color={C.yellow} bg="#191400" bd="#504400" />
                  <Chip label={`${latest.triggerConfirmationCount} SUPPORTING SIGNALS`} color={C.cyan} bg="#051414" bd={`${C.cyan}35`} />
                </div>
                <div style={{ color: C.mid, fontSize: "0.57rem", fontFamily: C.mono, lineHeight: 1.55 }}>
                  {latest.triggerConfirmations.join(" • ")}
                </div>
              </div>
            )}
          </div>

          {latestTouch && latestTouch.id !== latest.id && latestTouch.entryPrice == null && (
            <div style={{ background: "#141100", border: `1px solid ${C.yellow}25`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ color: C.yellow, fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", fontFamily: C.mono, marginBottom: 4 }}>LATEST TOUCH DID NOT CONFIRM</div>
              <div style={{ color: C.mid, fontSize: "0.58rem", fontFamily: C.mono, lineHeight: 1.55 }}>
                {latestTouch.narrative}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: 8, marginBottom: 10 }}>
            <MetricBox label="ZONE" value={`$${latest.oteBottom}-$${latest.oteTop}`} color={C.light} big />
            <MetricBox label="ENTRY" value={latest.entryPrice != null ? `$${latest.entryPrice}` : "—"} color={C.light} big />
            <MetricBox label="STOP" value={latest.stop != null ? `$${latest.stop}` : "—"} color={C.red} big />
            <MetricBox label="TARGET" value={latest.target != null ? `$${latest.target}` : "—"} color={C.green} big />
          </div>

          {latest.outcome && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
              <MetricBox label="MAX RUN" value={`${latest.outcome.maxFavorablePct >= 0 ? "+" : ""}${latest.outcome.maxFavorablePct}%`} color={C.green} />
              <MetricBox label="MAX HEAT" value={`-${Math.abs(latest.outcome.maxAdversePct).toFixed(2)}%`} color={C.red} />
              <MetricBox label="20-BAR CLOSE" value={`${latest.outcome.closeReturnPct >= 0 ? "+" : ""}${latest.outcome.closeReturnPct}%`} color={latest.outcome.closeReturnPct >= 0 ? C.green : C.red} />
              <MetricBox label="BARS" value={latest.outcome.barsObserved} color={C.mid} />
            </div>
          )}

          {latest.bestRuleExit && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 10 }}>
              <div style={{ background: "#091409", border: `1px solid ${C.green}25`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ color: C.dim, fontSize: "0.52rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 4 }}>BEST RULE-BASED EXIT</div>
                <div style={{ color: C.green, fontSize: "0.68rem", fontFamily: C.mono, fontWeight: 700, marginBottom: 3 }}>{latest.bestRuleExit.label}</div>
                <div style={{ color: C.mid, fontSize: "0.58rem", fontFamily: C.mono, lineHeight: 1.55 }}>
                  Exit {latest.bestRuleExit.barsHeld} bars later at ${latest.bestRuleExit.exitPrice} for {latest.bestRuleExit.pnlPct >= 0 ? "+" : ""}{latest.bestRuleExit.pnlPct}%.
                </div>
              </div>
              {latest.defensiveRuleExit && (
                <div style={{ background: "#140d00", border: `1px solid ${C.yellow}25`, borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ color: C.dim, fontSize: "0.52rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 4 }}>DEFENSIVE EXIT</div>
                  <div style={{ color: C.yellow, fontSize: "0.68rem", fontFamily: C.mono, fontWeight: 700, marginBottom: 3 }}>{latest.defensiveRuleExit.label}</div>
                  <div style={{ color: C.mid, fontSize: "0.58rem", fontFamily: C.mono, lineHeight: 1.55 }}>
                    {latest.defensiveRuleExit.reason === "hard stop"
                      ? "This setup needed the hard stop."
                      : `Fastest reasonable defense using current indicators: ${latest.defensiveRuleExit.pnlPct >= 0 ? "+" : ""}${latest.defensiveRuleExit.pnlPct}%.`}
                  </div>
                </div>
              )}
            </div>
          )}

          {aggregate?.leaderboard?.length > 0 && (
            <div style={{ marginBottom: activeReview.reviews?.length > 1 ? 10 : 0 }}>
              <SecHead left="EXIT RULE RANKING" right={`${aggregate.triggeredCount} TRIGGERED SETUPS`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {aggregate.leaderboard.slice(0, 3).map((rule, index) => (
                  <div key={rule.rule} style={{ background: "#081008", border: `1px solid ${index === 0 ? `${C.green}25` : C.border}`, borderRadius: 8, padding: "9px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: index === 0 ? C.green : C.mid, fontSize: "0.62rem", fontFamily: C.mono, fontWeight: 700 }}>#{index + 1}</span>
                        <span style={{ color: C.light, fontSize: "0.64rem", fontFamily: C.mono, fontWeight: 700 }}>{rule.label}</span>
                        {aggregate.bestOverallRule?.rule === rule.rule && <Chip label="BEST OVERALL" color={C.green} bg="#0b2214" bd={`${C.green}40`} />}
                        {aggregate.bestDefensiveRule?.rule === rule.rule && <Chip label="BEST DEFENSIVE" color={C.yellow} bg="#191400" bd="#504400" />}
                      </div>
                      <span style={{ color: rule.avgPnlPct >= 0 ? C.green : C.red, fontSize: "0.58rem", fontFamily: C.mono }}>
                        {rule.avgPnlPct >= 0 ? "+" : ""}{rule.avgPnlPct}% avg
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 6 }}>
                      <div style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono }}>Win {rule.winRate}%</div>
                      <div style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono }}>Capture {rule.captureRate}%</div>
                      <div style={{ color: C.dim, fontSize: "0.54rem", fontFamily: C.mono }}>Hold {rule.avgBarsHeld} bars</div>
                      {rule.defensiveImprovement != null && (
                        <div style={{ color: rule.defensiveImprovement >= 0 ? C.yellow : C.red, fontSize: "0.54rem", fontFamily: C.mono }}>
                          Defense {rule.defensiveImprovement >= 0 ? "+" : ""}{rule.defensiveImprovement}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {replayReviews.length > 0 && (
            <div style={{ marginBottom: activeReview.reviews?.length > 1 ? 10 : 0 }}>
              <SecHead left="SETUP REPLAY STRIP" right={`SCALE ±${replayScale.toFixed(1)}%`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {replayReviews.map((review) => (
                  <div key={review.id} style={{ background: "#081008", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Chip label={`${review.direction} OTE`} color={review.direction === "LONG" ? C.green : C.red} />
                        <span style={{ color: C.mid, fontSize: "0.56rem", fontFamily: C.mono }}>
                          {formatReviewDate(review.entryDate || review.zoneDate, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <span style={{ color: review.bestRuleExit?.pnlPct >= 0 ? C.green : C.red, fontSize: "0.56rem", fontFamily: C.mono }}>
                        Best exit {review.bestRuleExit?.pnlPct >= 0 ? "+" : ""}{review.bestRuleExit?.pnlPct ?? 0}%
                      </span>
                    </div>
                    <div style={{ position: "relative", height: 16, background: "#090f09", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: `${C.border}` }} />
                      <div style={{
                        position: "absolute",
                        right: "50%",
                        top: 3,
                        height: 10,
                        width: spanPct(review.outcome?.maxAdversePct ?? 0),
                        background: `${C.red}50`,
                        borderRadius: "999px 0 0 999px",
                      }} />
                      <div style={{
                        position: "absolute",
                        left: "50%",
                        top: 3,
                        height: 10,
                        width: spanPct(review.outcome?.maxFavorablePct ?? 0),
                        background: `${C.green}50`,
                        borderRadius: "0 999px 999px 0",
                      }} />
                      <div style={{
                        position: "absolute",
                        left: `calc(${linePct(review.bestRuleExit?.pnlPct ?? 0)} - 4px)`,
                        top: 1,
                        width: 8,
                        height: 14,
                        borderRadius: 4,
                        background: C.yellow,
                        boxShadow: `0 0 0 1px ${C.bg}`,
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", color: C.dim, fontSize: "0.52rem", fontFamily: C.mono }}>
                      <span>MAE -{Math.abs(review.outcome?.maxAdversePct ?? 0).toFixed(2)}%</span>
                      <span>{review.bestRuleExit?.label || "Rule exit"} {review.bestRuleExit?.pnlPct >= 0 ? "+" : ""}{review.bestRuleExit?.pnlPct ?? 0}%</span>
                      <span>MFE +{Math.abs(review.outcome?.maxFavorablePct ?? 0).toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeReview.reviews?.length > 1 && (
            <div>
              <SecHead left="RECENT OTE REVIEWS" right={`${activeReview.reviews.length} FOUND`} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {activeReview.reviews.slice(0, 4).map((review) => (
                  <div key={review.id} style={{ background: "#081008", border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Chip label={`${review.direction} OTE`} color={review.direction === "LONG" ? C.green : C.red} />
                        <span style={{ color: C.mid, fontSize: "0.56rem", fontFamily: C.mono }}>
                          {review.entryPrice != null ? `${review.bestRuleExit?.label || "Rule exit"} ${review.bestRuleExit?.pnlPct >= 0 ? "+" : ""}${review.bestRuleExit?.pnlPct ?? 0}%` : "No entry trigger"}
                        </span>
                      </div>
                      <span style={{ color: C.dim, fontSize: "0.52rem", fontFamily: C.mono }}>
                        {formatReviewDate(review.entryDate || review.zoneDate, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div style={{ color: C.dim, fontSize: "0.56rem", fontFamily: C.mono, lineHeight: 1.55 }}>
                      {review.entryPrice != null
                        ? `Entry $${review.entryPrice} | MFE ${review.outcome?.maxFavorablePct ?? 0}% | MAE ${review.outcome?.maxAdversePct ?? 0}%`
                        : review.narrative}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export function ActionSignalCard({ d, analysis }) {
  if (!d) return null;
  const meta = SIGNALS[d.signal] || SIGNALS["NEUTRAL"];
  const cc = d.confidence >= 70 ? C.green : d.confidence >= 50 ? C.yellow : C.red;
  const rr = d.entry > 0 && d.stop !== d.entry
    ? (Math.abs(d.target - d.entry) / Math.abs(d.entry - d.stop)).toFixed(1) : "2.0";
  const reasons = (d.indicators || []).filter((item) => item.status !== "warn" && item.status !== "fail").slice(0, 3);
  const risks = (d.indicators || []).filter((item) => item.status === "warn" || item.status === "fail").slice(0, 2);

  return (
    <Card style={{ padding: 0, overflow: "hidden", border: `1px solid ${meta.color}30` }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ color: C.dim, fontSize: "0.57rem", letterSpacing: "0.15em", fontFamily: C.mono }}>ACTION SIGNAL</span>
              {d.adaptiveScored && (
                <Chip label="ADAPTIVE" color={C.cyan} bg="#051414" bd={`${C.cyan}35`} />
              )}
            </div>
            <div style={{ fontFamily: C.raj, fontSize: "1.65rem", fontWeight: 700, color: meta.color, letterSpacing: "0.04em", lineHeight: 1 }}>
              {d.signal}
            </div>
            <div style={{ color: C.dim, fontSize: "0.55rem", letterSpacing: "0.1em", fontFamily: C.mono, marginTop: 4 }}>
              {d.ticker} · {d.timeframe}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: cc, fontSize: "1.9rem", fontWeight: 800, lineHeight: 0.95, fontFamily: C.raj }}>{d.confidence}%</div>
            <div style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>confidence</div>
          </div>
        </div>

        {analysis && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: C.light, fontSize: "0.94rem", fontWeight: 800, lineHeight: 1.15, fontFamily: C.raj, marginBottom: 5 }}>
              {analysis.heroLead}
            </div>
            <div style={{ color: C.light, fontSize: "0.63rem", fontFamily: C.mono, lineHeight: 1.6 }}>
              {analysis.heroSub}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 12 }}>
          {[
            { l: "ENTRY", v: `$${d.entry}`, sub: "market", c: C.light },
            { l: "STOP", v: `$${d.stop}`, sub: `${d.stopPct}%`, c: C.red },
            { l: "TARGET", v: `$${d.target}`, sub: `${d.tgtPct}%`, c: C.green },
          ].map((box) => (
            <div key={box.l} style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 10px" }}>
              <div style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", marginBottom: 3, fontFamily: C.mono }}>{box.l}</div>
              <div style={{ color: box.c, fontSize: "0.98rem", fontWeight: 800, fontFamily: C.mono }}>{box.v}</div>
              <div style={{ color: C.dim, fontSize: "0.56rem", fontFamily: C.mono }}>{box.sub}</div>
            </div>
          ))}
        </div>

        <TagRow items={[`R:R ${rr}:1`, `SCORE ${d.score}/100`, `ADX ${d.adx}`, `VOL ${d.vol}x`]} />
      </div>

      <div style={{ background: "#050a05", borderTop: `1px solid ${C.border}`, padding: "12px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <div>
            <div style={{ color: C.dim, fontSize: "0.5rem", letterSpacing: "0.1em", marginBottom: 6, fontFamily: C.mono }}>TOP REASONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {reasons.length
                ? reasons.map((item) => (
                    <div key={item.label} style={{ color: C.mid, fontSize: "0.59rem", fontFamily: C.mono, lineHeight: 1.45 }}>
                      + {item.label}
                    </div>
                  ))
                : <div style={{ color: C.dim, fontSize: "0.57rem", fontFamily: C.mono }}>No dominant confirmations.</div>}
            </div>
          </div>
          <div>
            <div style={{ color: C.dim, fontSize: "0.5rem", letterSpacing: "0.1em", marginBottom: 6, fontFamily: C.mono }}>MAIN RISKS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {risks.length
                ? risks.map((item) => (
                    <div key={item.label} style={{ color: item.status === "fail" ? C.red : C.yellow, fontSize: "0.59rem", fontFamily: C.mono, lineHeight: 1.45 }}>
                      - {item.label}
                    </div>
                  ))
                : <div style={{ color: C.dim, fontSize: "0.57rem", fontFamily: C.mono }}>No urgent risks from the current stack.</div>}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TradeNarrativeCard({ analysis, signal }) {
  if (!analysis) return null;
  const meta = SIGNALS[signal] || SIGNALS["NEUTRAL"];
  const cc = analysis.conviction === "HIGH" ? C.green : analysis.conviction === "MEDIUM" ? C.yellow : C.red;
  const title = analysis.contextTitle || "TRADE NARRATIVE";
  const body = analysis.contextBody || analysis.summary || analysis.commentary;

  return (
    <Card style={{ border: `1px solid ${meta.color}25` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ color: C.cyan, fontSize: "0.6rem", letterSpacing: "0.12em", fontFamily: C.mono }}>{title.toUpperCase()}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {analysis.ivEnvironment && (
            <Chip
              label={`IV ${analysis.ivEnvironment}`}
              color={analysis.ivEnvironment === "HIGH" ? C.orange : analysis.ivEnvironment === "LOW" ? C.cyan : C.mid}
              bg={analysis.ivEnvironment === "HIGH" ? "#1a0d00" : "#001414"}
            />
          )}
          <Chip label={`${analysis.conviction} CONVICTION`} color={cc} bg={cc + "18"} bd={cc + "40"} />
        </div>
      </div>

      <p style={{ color: C.light, fontSize: "0.64rem", fontFamily: C.mono, lineHeight: 1.7, marginBottom: 12 }}>
        {body}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 10 }}>
        <div style={{ background: "#091409", border: `1px solid ${C.green}25`, borderRadius: 6, padding: "9px 11px" }}>
          <div style={{ color: C.dim, fontSize: "0.52rem", letterSpacing: "0.1em", marginBottom: 4, fontFamily: C.mono }}>KEY STRENGTH</div>
          <div style={{ color: C.green, fontSize: "0.61rem", fontFamily: C.mono, lineHeight: 1.55 }}>{analysis.keyStrength}</div>
        </div>
        <div style={{ background: "#140909", border: `1px solid ${C.red}25`, borderRadius: 6, padding: "9px 11px" }}>
          <div style={{ color: C.dim, fontSize: "0.52rem", letterSpacing: "0.1em", marginBottom: 4, fontFamily: C.mono }}>KEY RISK</div>
          <div style={{ color: C.red, fontSize: "0.61rem", fontFamily: C.mono, lineHeight: 1.55 }}>{analysis.keyRisk}</div>
        </div>
      </div>

      {analysis.ivNote && (
        <div style={{ background: "#06090a", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 11px", marginBottom: 8 }}>
          <span style={{ color: C.orange, fontSize: "0.55rem", fontWeight: 700, fontFamily: C.mono }}>IV ENVIRONMENT: </span>
          <span style={{ color: C.mid, fontSize: "0.57rem", fontFamily: C.mono }}>{analysis.ivNote}</span>
        </div>
      )}

      <div style={{ background: "#0c180c", border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 12px" }}>
        <span style={{ color: C.yellow, fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.1em", fontFamily: C.mono }}>TRADE PLAN: </span>
        <span style={{ color: C.mid, fontSize: "0.61rem", fontFamily: C.mono }}>{analysis.suggestion}</span>
      </div>
    </Card>
  );
}

// --- Signal Header ---
export function SignalHeader({ d, analysis }) {
  const meta = SIGNALS[d.signal] || SIGNALS["NEUTRAL"];
  const cc = d.confidence >= 70 ? C.green : d.confidence >= 50 ? C.yellow : C.red;
  const rr = d.entry > 0 && d.stop !== d.entry
    ? (Math.abs(d.target - d.entry) / Math.abs(d.entry - d.stop)).toFixed(1) : "2.0";

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
              <span style={{ color: C.dim, fontSize: "0.57rem", letterSpacing: "0.15em", fontFamily: C.mono }}>ACTION SIGNAL</span>
              {d.adaptiveScored && (
                <span style={{ background: "#06b6d420", border: "1px solid #06b6d450", color: "#06b6d4",
                  fontSize: "0.48rem", padding: "1px 6px", borderRadius: 3, fontFamily: C.mono, fontWeight: 700,
                  letterSpacing: "0.08em" }}>ADAPTIVE</span>
              )}
            </div>
            <div style={{ fontFamily: C.raj, fontSize: "1.85rem", fontWeight: 700, color: meta.color, letterSpacing: "0.04em", lineHeight: 1 }}>{d.signal}</div>
            {d.adaptiveScored && d.originalSignal !== d.signal && (
              <div style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono, marginTop: 2 }}>
                was {d.originalSignal} (score {d.originalScore}) before backtest tuning
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.dim, fontSize: "0.55rem", letterSpacing: "0.1em", fontFamily: C.mono }}>{d.ticker} · {d.timeframe}</div>
          </div>
        </div>
        {analysis && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            alignItems: "start",
            marginBottom: 12,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: C.light, fontSize: "0.88rem", fontWeight: 800, lineHeight: 1.15, fontFamily: C.raj, marginBottom: 5 }}>
                {analysis.heroLead}
              </div>
              <div style={{ color: C.light, fontSize: "0.66rem", fontFamily: C.mono, lineHeight: 1.6 }}>
                {analysis.heroSub}
              </div>
            </div>
            <div style={{
              minWidth: 0,
              textAlign: "right",
              borderLeft: `1px solid ${C.border}`,
              paddingLeft: 12,
            }}>
              <div style={{ color: cc, fontSize: "2.05rem", fontWeight: 800, lineHeight: 0.95, fontFamily: C.raj }}>{d.confidence}%</div>
              <div style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>confidence</div>
            </div>
          </div>
        )}
      </div>
      <div style={{ background: "#050a05", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "0 16px 16px" }}>
        <div style={{ background: "#0d1a0d", borderRadius: 2, height: 4, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ background: meta.bar, width: `${Math.min(d.confidence, 100)}%`, height: "100%", borderRadius: 2, transition: "width 0.6s ease" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 8, marginBottom: 12 }}>
          {[
            { l: "ENTRY", v: `$${d.entry}`, sub: "market", c: C.light },
            { l: "STOP", v: `$${d.stop}`, sub: `${d.stopPct}%`, c: C.red },
            { l: "TARGET", v: `$${d.target}`, sub: `${d.tgtPct}%`, c: C.green },
          ].map(b => (
            <div key={b.l} style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 10px" }}>
              <div style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", marginBottom: 3, fontFamily: C.mono }}>{b.l}</div>
              <div style={{ color: b.c, fontSize: "1rem", fontWeight: 800, fontFamily: C.mono }}>{b.v}</div>
              <div style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>{b.sub}</div>
            </div>
          ))}
        </div>
        <TagRow items={[`R:R ${rr}:1`, `SCORE ${d.score}/100`, `ADX ${d.adx}`, `VOL ${d.vol}x`, `rVWAP ${d.aboveVWAP ? "^" : "v"}`, `ST ${d.supertrend ? "^" : "v"}`]} />
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 12 }}>
          {d.indicators.map((ind, i) => {
            const w = ind.status === "warn", f = ind.status === "fail";
            const ic = w ? C.yellow : f ? C.red : C.green;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: "0.65rem", minWidth: 12, color: ic, fontFamily: C.mono, animation: w ? "pulse 2s infinite" : "none" }}>
                  {w ? "!" : f ? "x" : "o"}
                </span>
                <span style={{ color: w ? C.yellow : f ? C.red : C.mid, fontSize: "0.63rem", flex: 1, fontFamily: C.mono, letterSpacing: "0.02em" }}>{ind.label}</span>
                <Chip label={ind.type} color={ind.type === "LEADING" ? C.yellow : C.green}
                  bg={ind.type === "LEADING" ? "#191400" : "#0b2214"} bd={ind.type === "LEADING" ? "#504400" : "#185030"} />
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// --- Early Warnings ---
export function EarlyWarnings({ warnings }) {
  return (
    <Card>
      <SecHead left="EARLY WARNING SIGNALS" right="LEADING INDICATORS" />
      {!warnings.length
        ? <p style={{ color: C.dim, fontSize: "0.62rem", fontFamily: C.mono }}>No early signals — market in established trend or wait phase.</p>
        : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {warnings.map((w, i) => (
              <div key={i} style={{
                borderLeft: `3px solid ${w.color}`,
                background: "#081008",
                border: `1px solid ${w.color}25`,
                borderRadius: 8,
                padding: "11px 12px 11px 14px",
                boxShadow: `inset 0 1px 0 ${w.color}25`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ color: w.color, fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.08em", fontFamily: C.mono }}>{w.icon} {w.title}</span>
                  <Chip label="LEADING" color={C.yellow} bg="#191400" bd="#504400" />
                </div>
                <div style={{ width: "100%", height: 2, background: w.color + "35", borderRadius: 999, marginBottom: 8 }} />
                <p style={{ color: C.light, fontSize: "0.61rem", fontFamily: C.mono, lineHeight: 1.65 }}>{w.desc}</p>
              </div>
            ))}
          </div>
      }
    </Card>
  );
}

// --- Pattern Breakouts ---
export function PatternBreakouts({ patterns }) {
  if (!patterns.length) return null;
  return (
    <Card>
      <SecHead left="PATTERN BREAKOUTS" />
      {patterns.map((p, i) => (
        <div key={i} style={{
          borderLeft: `3px solid ${p.borderColor}`, background: "#090f09",
          border: `1px solid ${C.border}`, borderRadius: 7, padding: "12px 14px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ color: C.light, fontSize: "0.82rem", fontWeight: 700, fontFamily: C.raj }}>{p.dir} {p.name}</span>
            <span style={{ background: p.patColor + "22", border: `1px solid ${p.patColor}55`, color: p.patColor, fontSize: "0.58rem", padding: "2px 8px", borderRadius: 3, fontFamily: C.mono, fontWeight: 700 }}>{p.patType}</span>
          </div>
          <div style={{ color: C.dim, fontSize: "0.59rem", fontFamily: C.mono, fontStyle: "italic", marginBottom: 5 }}>{p.subtitle}</div>
          <div style={{ color: C.mid, fontSize: "0.62rem", fontFamily: C.mono, marginBottom: 5 }}>{p.detail}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: C.dim, fontSize: "0.59rem", fontFamily: C.mono }}>Reliability:</span>
            <span style={{ color: C.green, fontSize: "0.62rem", fontFamily: C.mono, fontWeight: 700 }}>{p.reliability}%</span>
            <span style={{ color: C.dim, fontSize: "0.59rem", fontFamily: C.mono }}>TGT</span>
            <span style={{ color: p.tgtPct < 0 ? C.red : C.green, fontSize: "0.62rem", fontFamily: C.mono, fontWeight: 700 }}>{p.tgtPct}%</span>
            <span style={{ color: C.dim, fontSize: "0.59rem", fontFamily: C.mono }}>STOP</span>
            <span style={{ color: C.red, fontSize: "0.62rem", fontFamily: C.mono, fontWeight: 700 }}>${p.patStop}</span>
          </div>
        </div>
      ))}
    </Card>
  );
}

// --- Signal Cards Grid ---
export function SignalCards({ d }) {
  const oteActive = d.ote?.validStructureBreak && d.ote?.inOTE;
  const oteApproaching = d.ote?.validStructureBreak && d.ote?.approaching;
  const narrativeTiles = [
    {
      l: "MOMENTUM",
      v: d.macdDir === "Bull" ? "BULLISH" : "BEARISH",
      sub: `MACD ${d.macdDir === "Bull" ? "supports continuation" : "leans lower"}`,
      accent: d.macdDir === "Bull" ? C.green : C.red,
    },
    {
      l: "FLOW",
      v: d.cmf > 0.1 ? "ACCUM" : d.cmf < -0.1 ? "DIST" : "MIXED",
      sub: `CMF ${Number(d.cmf).toFixed(2)} ${d.cmf > 0.1 ? "buyers in control" : d.cmf < -0.1 ? "sellers pressing" : "flow balanced"}`,
      accent: d.cmf > 0.1 ? C.green : d.cmf < -0.1 ? C.red : C.yellow,
    },
    {
      l: "TREND",
      v: d.adxFull?.plusDI > d.adxFull?.minusDI ? "BULL TREND" : d.adxFull?.minusDI > d.adxFull?.plusDI ? "BEAR TREND" : "UNSET",
      sub: `ADX ${d.adx} · +DI ${d.adxFull?.plusDI ?? "--"} / -DI ${d.adxFull?.minusDI ?? "--"}`,
      accent: d.adxFull?.plusDI > d.adxFull?.minusDI ? C.green : d.adxFull?.minusDI > d.adxFull?.plusDI ? C.red : C.yellow,
    },
    {
      l: "SQUEEZE",
      v: d.ttmSqueeze?.firing ? (d.ttmSqueeze.momentum > 0 ? "FIRED UP" : "FIRED DOWN") : d.ttmSqueeze?.squeezeOn ? "LOCKED" : "OPEN",
      sub: d.ttmSqueeze?.firing
        ? `Momentum ${d.ttmSqueeze.momentum > 0 ? "expanding higher" : "expanding lower"}`
        : d.ttmSqueeze?.squeezeOn
        ? "Compression building"
        : "No active squeeze",
      accent: d.ttmSqueeze?.firing ? (d.ttmSqueeze.momentum > 0 ? C.green : C.red) : d.ttmSqueeze?.squeezeOn ? C.purple : C.dim,
    },
    {
      l: "RSI DIV",
      v: d.rsiDiv?.bullishDiv ? "BULLISH" : d.rsiDiv?.bearishDiv ? "BEARISH" : "NONE",
      sub: d.rsiDiv?.bullishDiv
        ? "Momentum improving into weakness"
        : d.rsiDiv?.bearishDiv
        ? "Momentum fading into highs"
        : `RSI ${Number(d.rsi).toFixed(1)} with no divergence`,
      accent: d.rsiDiv?.bullishDiv ? C.green : d.rsiDiv?.bearishDiv ? C.red : C.yellow,
    },
    {
      l: "HEIKIN",
      v: d.heikinAshi?.trend === "bullish" ? `${d.heikinAshi.consecutiveGreen} GREEN` : d.heikinAshi?.trend === "bearish" ? `${d.heikinAshi.consecutiveRed} RED` : "NEUTRAL",
      sub: d.heikinAshi?.trend === "bullish"
        ? "Trend candles still pressing up"
        : d.heikinAshi?.trend === "bearish"
        ? "Trend candles still pressing down"
        : "No clear persistence",
      accent: d.heikinAshi?.trend === "bullish" ? C.green : d.heikinAshi?.trend === "bearish" ? C.red : C.yellow,
    },
    {
      l: "OTE",
      v: oteActive ? "ACTIVE" : oteApproaching ? "NEAR" : "NONE",
      sub: oteActive
        ? `${d.ote.direction} setup in ${d.ote.retracementPct}% retrace zone`
        : oteApproaching
        ? `${d.ote.direction} pullback approaching zone`
        : "No active OTE pullback",
      accent: oteActive ? C.green : oteApproaching ? C.yellow : C.dim,
    },
    {
      l: "PARTICIPATION",
      v: d.vol < 0.5 ? "THIN" : d.vol < 1 ? "LIGHT" : d.vol >= 1.5 ? "STRONG" : "NORMAL",
      sub: `${Number(d.vol).toFixed(1)}x avg volume`,
      accent: d.vol < 0.5 ? C.red : d.vol < 1 ? C.yellow : d.vol >= 1.5 ? C.green : C.cyan,
    },
    {
      l: "RISK ENV",
      v: d.atrPct >= 3 ? "FAST" : d.atrPct >= 1.5 ? "NORMAL" : "QUIET",
      sub: `ATR ${d.atrPct}% · BB ${d.bbPct}%`,
      accent: d.atrPct >= 3 ? C.orange : d.atrPct >= 1.5 ? C.yellow : C.cyan,
    },
  ];
  return (
    <Card>
      <SecHead left="SIGNAL CARDS" right="NARRATIVE VIEW" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {narrativeTiles.map((tile) => (
          <div key={tile.l} style={{
            background: "#081008",
            border: `1px solid ${tile.accent}25`,
            borderRadius: 8,
            padding: "10px 11px",
            minHeight: 96,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: `inset 0 1px 0 ${tile.accent}20`,
          }}>
            <div>
              <div style={{ color: C.dim, fontSize: "0.5rem", letterSpacing: "0.11em", marginBottom: 5, fontFamily: C.mono }}>{tile.l}</div>
              <div style={{ color: tile.accent, fontSize: "0.92rem", fontWeight: 800, fontFamily: C.raj, lineHeight: 1 }}>{tile.v}</div>
            </div>
            <div style={{ color: C.light, fontSize: "0.56rem", fontFamily: C.mono, lineHeight: 1.45, marginTop: 8 }}>
              {tile.sub}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// --- Options Play (multi-strategy with risk tiers) ---
export function OptionsPlay({ d }) {
  if (!d.opts?.show) return null;
  const isLong = d.signal.includes("LONG");
  const isShort = d.signal.includes("SHORT");
  const isNeutral = d.signal === "NEUTRAL";
  const iv = d.analysis?.ivEnvironment || "NORMAL";
  const price = d.entry;
  const atrAbs = price * (d.atrPct / 100);

  // Strike math
  const step = price > 500 ? 5 : price > 100 ? 1 : price > 50 ? 0.5 : 0.5;
  const rnd = (n) => Math.round(n / step) * step;

  // DTE logic
  let dte, dteReason;
  if (iv === "HIGH" && d.adx > 25) { dte = "14-21"; dteReason = "High IV + strong trend — shorter DTE captures decay"; }
  else if (iv === "HIGH") { dte = "21-35"; dteReason = "High IV — sell premium, let theta work"; }
  else if (iv === "LOW" && d.adx > 30) { dte = "30-45"; dteReason = "Low IV + trend — buy premium, give time"; }
  else { dte = "21-28"; dteReason = "Standard conditions"; }

  // ============ BUILD STRATEGIES ============
  const strategies = [];

  // 1. SPREAD (primary — defined risk)
  if (isLong) {
    const buyStrike = rnd(price);
    const sellStrike = rnd(price + atrAbs * 2);
    strategies.push({
      name: "BULL CALL SPREAD", risk: "DEFINED", riskColor: "#22c55e",
      legs: [
        { action: "BUY CALL", strike: buyStrike, delta: "0.55-0.65" },
        { action: "SELL CALL", strike: sellStrike, delta: "0.25-0.35" },
      ],
      note: `Max loss = premium paid. Max profit at $${sellStrike}+. Spread width: $${(sellStrike - buyStrike).toFixed(2)}.`,
      exit: "Exit at 50-80% max profit or if signal flips.",
    });
  } else if (isShort) {
    const buyStrike = rnd(price);
    const sellStrike = rnd(price - atrAbs * 2);
    strategies.push({
      name: "BEAR PUT SPREAD", risk: "DEFINED", riskColor: "#22c55e",
      legs: [
        { action: "BUY PUT", strike: buyStrike, delta: "0.55-0.65" },
        { action: "SELL PUT", strike: sellStrike, delta: "0.25-0.35" },
      ],
      note: `Max loss = premium paid. Max profit at $${sellStrike}-. Spread width: $${(buyStrike - sellStrike).toFixed(2)}.`,
      exit: "Exit at 50-80% max profit or if signal flips.",
    });
  } else {
    const callStrike = rnd(price + atrAbs * 2);
    const putStrike = rnd(price - atrAbs * 2);
    strategies.push({
      name: "IRON CONDOR", risk: "DEFINED", riskColor: "#22c55e",
      legs: [
        { action: "SELL CALL", strike: callStrike, delta: "0.20-0.30" },
        { action: "SELL PUT", strike: putStrike, delta: "0.20-0.30" },
      ],
      note: `Neutral play. Profit if price stays between $${putStrike}-$${callStrike}. Max loss = spread width - credit.`,
      exit: "Exit at 50% profit or 21 DTE, whichever first.",
    });
  }

  // 2. CASH-SECURED PUT (bullish / neutral — income strategy)
  if (isLong || isNeutral) {
    const cspStrike = rnd(price - atrAbs * 1.5);
    const assignment = (cspStrike * 100).toFixed(0);
    strategies.push({
      name: "CASH-SECURED PUT", risk: "MODERATE", riskColor: "#eab308",
      legs: [
        { action: "SELL PUT", strike: cspStrike, delta: "0.25-0.35" },
      ],
      note: `Collect premium. If assigned, you buy 100 shares at $${cspStrike} (${((1 - cspStrike / price) * 100).toFixed(1)}% discount). Cash needed: $${assignment}.`,
      exit: "Let expire OTM or roll if challenged. Close at 50% profit.",
      tag: iv === "HIGH" ? "BEST IN HIGH IV" : null,
    });
  }

  // 3. COVERED CALL (if already long — income on holdings)
  if (isLong || isNeutral) {
    const ccStrike = rnd(price + atrAbs * 1.5);
    strategies.push({
      name: "COVERED CALL", risk: "MODERATE", riskColor: "#eab308",
      legs: [
        { action: "SELL CALL", strike: ccStrike, delta: "0.25-0.30" },
      ],
      note: `If you own 100 shares: sell call at $${ccStrike} for income. Called away above $${ccStrike} (${((ccStrike / price - 1) * 100).toFixed(1)}% upside cap). Keep premium either way.`,
      exit: "Let expire or roll up/out if stock rallies past strike.",
      tag: "REQUIRES 100 SHARES",
    });
  }

  // 4. LONG OPTIONS (directional — higher risk, higher reward)
  if (!isNeutral) {
    const longStrike = isLong ? rnd(price - atrAbs * 0.5) : rnd(price + atrAbs * 0.5);
    const longType = isLong ? "CALL" : "PUT";
    strategies.push({
      name: `LONG ${longType}`, risk: "HIGH", riskColor: "#ef4444",
      legs: [
        { action: `BUY ${longType}`, strike: longStrike, delta: "0.60-0.70" },
      ],
      note: `Slightly ITM for higher delta. 100% of premium at risk. ${iv === "HIGH" ? "WARNING: High IV inflates premiums — you're overpaying." : iv === "LOW" ? "Low IV — cheaper entry, good for directional bets." : "Standard IV conditions."}`,
      exit: "Cut at -50% or if thesis breaks. Take profits at +100%.",
      tag: iv === "HIGH" ? "AVOID — IV INFLATED" : null,
    });
  }

  return (
    <Card>
      <SecHead left="OPTIONS STRATEGIES" right="MULTI-STRATEGY VIEW" />

      {/* IV + DTE context */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <Chip label={`IV: ${iv}`}
          color={iv === "HIGH" ? C.orange : iv === "LOW" ? C.cyan : C.mid}
          bg={iv === "HIGH" ? "#1a0d00" : "#001414"} />
        <Chip label={`${dte} DTE`} color={C.green} bg="#0a1a0a" bd={C.green + "40"} />
        <span style={{ color: C.dim, fontSize: "0.53rem", fontFamily: C.mono, alignSelf: "center" }}>{dteReason}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {strategies.map((s, i) => (
          <div key={i} style={{
            background: "#090f09",
            border: `1px solid ${i === 0 ? s.riskColor + "40" : C.border}`,
            borderRadius: 8, padding: 12,
            borderLeft: `3px solid ${s.riskColor}`,
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: C.light, fontFamily: C.raj, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.05em" }}>{s.name}</span>
                {i === 0 && <Chip label="PRIMARY" color={C.green} bg="#0b2214" bd="#185030" />}
              </div>
              <Chip label={`${s.risk} RISK`} color={s.riskColor} bg={s.riskColor + "15"} bd={s.riskColor + "40"} />
            </div>

            {/* Tags */}
            {s.tag && (
              <div style={{ marginBottom: 6 }}>
                <Chip label={s.tag}
                  color={s.tag.includes("AVOID") ? C.red : s.tag.includes("BEST") ? C.green : C.yellow}
                  bg={s.tag.includes("AVOID") ? "#1a0808" : "#0a1a0a"} />
              </div>
            )}

            {/* Legs */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${s.legs.length > 1 ? 120 : 160}px, 1fr))`, gap: 6, marginBottom: 8 }}>
              {s.legs.map((leg, j) => {
                const isBuy = leg.action.includes("BUY");
                return (
                  <div key={j} style={{
                    background: isBuy ? "#0b140b" : "#140808",
                    border: `1px solid ${isBuy ? C.green + "25" : C.red + "25"}`,
                    borderRadius: 5, padding: "7px 10px", textAlign: "center",
                  }}>
                    <div style={{ color: isBuy ? C.dim : "#6a3a3a", fontSize: "0.5rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 2 }}>{leg.action}</div>
                    <div style={{ color: isBuy ? C.green : C.red, fontSize: "0.9rem", fontWeight: 800, fontFamily: C.mono }}>${leg.strike}</div>
                    <div style={{ color: C.dim, fontSize: "0.48rem", fontFamily: C.mono }}>d {leg.delta}</div>
                  </div>
                );
              })}
            </div>

            {/* Note + Exit */}
            <p style={{ color: C.mid, fontSize: "0.57rem", fontFamily: C.mono, lineHeight: 1.6, marginBottom: 4 }}>{s.note}</p>
            <p style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, lineHeight: 1.5 }}>{s.exit}</p>
          </div>
        ))}
      </div>

      {/* Liquidity filter */}
      <div style={{ background: "#06090a", border: `1px solid ${C.border}`, borderRadius: 5, padding: "8px 12px", marginTop: 10 }}>
        <span style={{ color: C.cyan, fontSize: "0.55rem", fontWeight: 700, fontFamily: C.mono }}>LIQUIDITY FILTER: </span>
        <span style={{ color: C.mid, fontSize: "0.55rem", fontFamily: C.mono }}>
          Only trade strikes with open interest &gt; 500, daily volume &gt; 100, and bid-ask spread &lt; $0.15. Wider spreads eat your edge. Check the options chain before entering.
        </span>
      </div>
    </Card>
  );
}

// --- Earnings Calendar Card ---
export function EarningsCard({ earnings }) {
  if (!earnings) return null;

  const urgentColor = earnings.isImminent ? C.red : earnings.isUpcoming ? C.orange : C.green;
  const urgentLabel = earnings.isImminent ? "EARNINGS IMMINENT" : earnings.isUpcoming ? "EARNINGS SOON" : "EARNINGS";

  const formatDate = (d) => {
    if (!d) return "Unknown";
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <Card style={{ border: `1px solid ${urgentColor}30` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: urgentColor, fontSize: "0.6rem", letterSpacing: "0.12em", fontFamily: C.mono, fontWeight: 700 }}>
          {earnings.isImminent ? "⚠" : "📅"} {urgentLabel}
        </span>
        {earnings.beatRate !== null && (
          <Chip label={`${earnings.beatRate}% BEAT RATE`}
            color={earnings.beatRate >= 75 ? C.green : earnings.beatRate >= 50 ? C.yellow : C.red} />
        )}
      </div>

      {/* Next earnings */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 10px", textAlign: "center" }}>
          <div style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", marginBottom: 3, fontFamily: C.mono }}>NEXT DATE</div>
          <div style={{ color: urgentColor, fontSize: "0.82rem", fontWeight: 700, fontFamily: C.mono }}>
            {earnings.nextDate ? formatDate(earnings.nextDate) : "TBD"}
          </div>
        </div>
        <div style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 10px", textAlign: "center" }}>
          <div style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", marginBottom: 3, fontFamily: C.mono }}>DAYS UNTIL</div>
          <div style={{ color: urgentColor, fontSize: "1rem", fontWeight: 800, fontFamily: C.mono }}>
            {earnings.daysUntil !== null ? (earnings.daysUntil < 0 ? "PAST" : earnings.daysUntil) : "—"}
          </div>
        </div>
        <div style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "9px 10px", textAlign: "center" }}>
          <div style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", marginBottom: 3, fontFamily: C.mono }}>EST. EPS</div>
          <div style={{ color: C.light, fontSize: "1rem", fontWeight: 800, fontFamily: C.mono }}>
            {earnings.nextEstimate != null ? `$${earnings.nextEstimate.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      {/* Warning for options traders */}
      {earnings.isUpcoming && (
        <div style={{ background: earnings.isImminent ? "#1a0808" : "#191400",
          border: `1px solid ${earnings.isImminent ? C.red : C.orange}30`,
          borderRadius: 6, padding: "8px 12px", marginBottom: 12 }}>
          <span style={{ color: earnings.isImminent ? C.red : C.orange, fontSize: "0.57rem", fontWeight: 700, fontFamily: C.mono }}>
            {earnings.isImminent ? "⚠ WARNING: " : "⚡ HEADS UP: "}
          </span>
          <span style={{ color: C.mid, fontSize: "0.57rem", fontFamily: C.mono }}>
            {earnings.isImminent
              ? "Earnings within 3 days. IV crush will destroy long options. Avoid buying calls/puts. Consider iron condors or stay flat."
              : "Earnings within 2 weeks. IV is likely elevated. Selling premium (CSPs, covered calls) benefits from IV crush. Long options carry extra risk."}
          </span>
        </div>
      )}

      {/* Quarterly history */}
      {earnings.quarterly.length > 0 && (
        <div>
          <SecHead left="RECENT QUARTERS" right={`${earnings.beatStreak}/${earnings.quarterly.length} BEATS`} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {earnings.quarterly.map((q, i) => (
              <div key={i} style={{
                background: q.beat ? "#0b2214" : "#1a0808",
                border: `1px solid ${q.beat ? C.green : C.red}30`,
                borderRadius: 6, padding: "7px 10px", textAlign: "center", minWidth: 70,
              }}>
                <div style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono, marginBottom: 2 }}>{q.quarter}</div>
                <div style={{ color: q.beat ? C.green : C.red, fontSize: "0.72rem", fontWeight: 700, fontFamily: C.mono }}>
                  {q.actual != null ? `$${q.actual.toFixed(2)}` : "—"}
                </div>
                <div style={{ color: C.dim, fontSize: "0.48rem", fontFamily: C.mono }}>
                  est ${q.estimate != null ? q.estimate.toFixed(2) : "—"}
                </div>
                <div style={{ color: q.beat ? C.green : C.red, fontSize: "0.55rem", fontWeight: 700, fontFamily: C.mono }}>
                  {q.beat ? "BEAT" : "MISS"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical earnings (from chart events) */}
      {earnings.history.length > 0 && earnings.quarterly.length === 0 && (
        <div>
          <SecHead left="RECENT EARNINGS" />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {earnings.history.slice(0, 4).map((e, i) => (
              <div key={i} style={{
                background: e.beat ? "#0b2214" : "#1a0808",
                border: `1px solid ${e.beat ? C.green : C.red}30`,
                borderRadius: 6, padding: "7px 10px", textAlign: "center", minWidth: 70,
              }}>
                <div style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono, marginBottom: 2 }}>{formatDate(e.date)}</div>
                <div style={{ color: e.beat ? C.green : C.red, fontSize: "0.72rem", fontWeight: 700, fontFamily: C.mono }}>
                  {e.actual != null ? `$${e.actual.toFixed(2)}` : "—"}
                </div>
                <div style={{ color: C.dim, fontSize: "0.48rem", fontFamily: C.mono }}>
                  est ${e.estimate != null ? e.estimate.toFixed(2) : "—"}
                </div>
                {e.surprisePct != null && (
                  <div style={{ color: e.beat ? C.green : C.red, fontSize: "0.5rem", fontFamily: C.mono }}>
                    {e.beat ? "+" : ""}{e.surprisePct.toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
