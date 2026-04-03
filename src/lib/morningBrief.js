import { fetchCandleData } from "../api/finnhub.js";
import { buildSignalCard } from "../indicators/scoring.js";
import { reviewOteTriggers } from "../indicators/oteReview.js";

export const BUILTIN_BRIEF_WATCHLISTS = {
  "Mega Cap Tech": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA"],
  ETFs: ["SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLK", "GLD", "TLT"],
  Crypto: ["BTC", "ETH", "SOL", "XRP", "ADA", "AVAX", "LINK", "DOT"],
  Growth: ["PLTR", "SNOW", "CRWD", "DDOG", "NET", "ZS", "MDB"],
  "Value / Dividend": ["JPM", "V", "JNJ", "PG", "KO", "PFE", "CVX"],
};

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

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseTickerInput(input = "") {
  return input
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean);
}

export function resolveConfirmationTimeframe(primaryTimeframe, confirmMode = "AUTO") {
  if (confirmMode === "OFF") return null;
  if (confirmMode === "AUTO") return AUTO_CONFIRM_MAP[primaryTimeframe] || null;
  if (confirmMode === primaryTimeframe) return null;
  return confirmMode;
}

export function getSignalBias(signal) {
  if (!signal) return "NEUTRAL";
  if (signal.includes("LONG")) return "LONG";
  if (signal.includes("SHORT")) return "SHORT";
  return "NEUTRAL";
}

function getActionability(card) {
  const bias = getSignalBias(card?.signal);
  if (bias === "NEUTRAL") return 0;
  const edge = Math.abs((card?.score ?? 50) - 50);
  return edge >= 8 ? 2 : 1;
}

function getSignalEdge(card) {
  return Math.abs((card?.score ?? 50) - 50);
}

export function buildMtfState(primarySignal, confirmSignal, confirmTimeframe, error = null) {
  if (!confirmTimeframe) {
    return { status: "OFF", timeframe: null, signal: null, aligned: null, message: null };
  }

  if (error) {
    return { status: "UNAVAILABLE", timeframe: confirmTimeframe, signal: null, aligned: null, message: error };
  }

  const primaryBias = getSignalBias(primarySignal);
  const confirmBias = getSignalBias(confirmSignal);

  if (primaryBias === "NEUTRAL" || confirmBias === "NEUTRAL") {
    return { status: "MIXED", timeframe: confirmTimeframe, signal: confirmSignal, aligned: null, message: `${confirmTimeframe} mixed` };
  }

  const aligned = primaryBias === confirmBias;
  return {
    status: aligned ? "ALIGNED" : "CONFLICT",
    timeframe: confirmTimeframe,
    signal: confirmSignal,
    aligned,
    message: aligned ? `${confirmTimeframe} confirms` : `${confirmTimeframe} conflicts`,
  };
}

export async function buildBriefCard(ticker, timeframe, assetType, confirmTimeframe) {
  const raw = await fetchCandleData(ticker, timeframe, assetType);
  const card = buildSignalCard(ticker, timeframe, raw);

  if (!confirmTimeframe) {
    return { ...card, raw, assetType, mtf: buildMtfState(card.signal, null, null) };
  }

  try {
    const confirmRaw = await fetchCandleData(ticker, confirmTimeframe, assetType);
    const confirmCard = buildSignalCard(ticker, confirmTimeframe, confirmRaw);
    return {
      ...card,
      raw,
      assetType,
      mtf: buildMtfState(card.signal, confirmCard.signal, confirmTimeframe),
    };
  } catch (error) {
    return {
      ...card,
      raw,
      assetType,
      mtf: buildMtfState(card.signal, null, confirmTimeframe, error.message),
    };
  }
}

export function rankMorningBriefResults(results, sortBy = "score") {
  return [...results].sort((a, b) => {
    const actionabilityDiff = getActionability(b) - getActionability(a);
    if (actionabilityDiff !== 0) return actionabilityDiff;

    if (sortBy === "confidence") return (b.confidence || 0) - (a.confidence || 0);
    if (sortBy === "rsi") return (a.rsi || 50) - (b.rsi || 50);
    if (sortBy === "volume") return (b.vol || 0) - (a.vol || 0);
    if (sortBy === "mtf") {
      const mtfDiff = (MTF_SORT_RANK[b.mtf?.status || "OFF"] || 0) - (MTF_SORT_RANK[a.mtf?.status || "OFF"] || 0);
      if (mtfDiff !== 0) return mtfDiff;
      const edgeDiff = getSignalEdge(b) - getSignalEdge(a);
      if (edgeDiff !== 0) return edgeDiff;
      return (b.confidence || 0) - (a.confidence || 0);
    }
    const edgeDiff = getSignalEdge(b) - getSignalEdge(a);
    if (edgeDiff !== 0) return edgeDiff;
    return (b.confidence || 0) - (a.confidence || 0);
  });
}

export function shortSignal(signal = "") {
  if (signal === "STRONG LONG") return "STRONG LONG";
  if (signal === "LONG BIAS") return "LONG";
  if (signal === "SHORT BIAS") return "SHORT";
  if (signal === "STRONG SHORT") return "STRONG SHORT";
  return signal || "NEUTRAL";
}

export function summarizeOteReview(card) {
  try {
    const bias = getSignalBias(card?.signal);
    if (bias === "NEUTRAL") return "OTE not part of the current neutral setup.";
    const review = reviewOteTriggers(card.raw);
    const alignedReviews = (review.reviews || []).filter((item) => item.direction === bias);
    const latest = alignedReviews.find((item) => item.entryPrice != null) || alignedReviews[0];
    if (!latest) return `No recent ${bias.toLowerCase()} OTE review aligned with the current signal.`;
    if (!latest.entryPrice) return `${latest.direction} OTE touch, no trigger.`;
    return `${latest.direction} OTE triggered; best exit ${latest.bestRuleExit?.label || "n/a"} ${latest.bestRuleExit?.pnlPct >= 0 ? "+" : ""}${latest.bestRuleExit?.pnlPct ?? 0}%.`;
  } catch {
    return "OTE review unavailable.";
  }
}

export function clampPost(text, max = 280) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildSummaryPost(results, sourceLabel, timeframe, confirmTimeframe) {
  const top = results.slice(0, 3);
  const longCount = results.filter((item) => item.signal.includes("LONG")).length;
  const shortCount = results.filter((item) => item.signal.includes("SHORT")).length;
  const neutralCount = results.filter((item) => item.signal === "NEUTRAL").length;
  const topText = top.length
    ? top.map((item, index) => `${index + 1}) ${item.ticker} ${shortSignal(item.signal)} S${item.score}`).join(" | ")
    : "no clean setups cleared the screen";
  return clampPost(
    `Morning screener ${sourceLabel} ${timeframe}${confirmTimeframe ? `/${confirmTimeframe}` : ""}: ${topText}. Breadth: ${longCount} long / ${shortCount} short / ${neutralCount} neutral. Watching confirmation, not chasing. #stocks #trading`,
  );
}

export function buildThreadStarter(results, timeframe) {
  const top = results
    .slice(0, 3)
    .map((item) => `${item.ticker} ${shortSignal(item.signal)} S${item.score}/C${item.confidence}%`)
    .join(" • ") || "none qualified today";
  return clampPost(`Top 3 ${timeframe} setups from this morning’s screen: ${top}. Quick trade-plan notes below. #stocks #swingtrading`);
}

export function buildReply(card, index) {
  const lineOne = `${index + 1}/3 ${card.ticker} ${card.timeframe}: ${card.signal} (S${card.score}/C${card.confidence}%).`;
  const lineTwo = `Plan: entry $${card.entry}, stop $${card.stop}, target $${card.target}.`;
  const lineThree = `${card.analysis?.heroLead || card.analysis?.summary || "Mixed signal stack."} ${summarizeOteReview(card)}`;
  return clampPost(`${lineOne} ${lineTwo} ${lineThree} #stocks`);
}

export function resolveBriefUniverse({ source = "Mega Cap Tech", customTickers = "" } = {}) {
  if (customTickers.trim()) {
    return {
      sourceLabel: "CUSTOM LIST",
      tickers: parseTickerInput(customTickers),
      assetType: "US Stock",
    };
  }

  const tickers = BUILTIN_BRIEF_WATCHLISTS[source] || BUILTIN_BRIEF_WATCHLISTS["Mega Cap Tech"];
  const assetType = source === "Crypto" ? "Crypto" : source === "ETFs" ? "ETF" : "US Stock";
  return { sourceLabel: source, tickers, assetType };
}

export async function runMorningBrief({
  source = "Mega Cap Tech",
  customTickers = "",
  timeframe = "1D",
  confirmMode = "AUTO",
  sortBy = "score",
  topCount = 3,
  limit = 10,
  sleepMs = 150,
  onProgress,
} = {}) {
  const { sourceLabel, tickers, assetType } = resolveBriefUniverse({ source, customTickers });
  const confirmTimeframe = resolveConfirmationTimeframe(timeframe, confirmMode);

  if (!tickers.length) {
    throw new Error("No tickers configured for the morning brief.");
  }

  const cards = [];
  for (let index = 0; index < tickers.length; index++) {
    try {
      cards.push(await buildBriefCard(tickers[index], timeframe, assetType, confirmTimeframe));
    } catch (error) {
      cards.push({
        ticker: tickers[index],
        timeframe,
        assetType,
        signal: "NEUTRAL",
        score: 0,
        confidence: 0,
        entry: 0,
        stop: 0,
        target: 0,
        rsi: 50,
        vol: 0,
        adx: 0,
        analysis: { heroLead: "Data fetch failed." },
        mtf: buildMtfState("NEUTRAL", null, confirmTimeframe, error.message),
        raw: null,
        error: error.message,
      });
    }

    onProgress?.({ done: index + 1, total: tickers.length, ticker: tickers[index] });
    if (index < tickers.length - 1) await sleep(sleepMs);
  }

  const failures = cards.filter((card) => card.error);
  const successfulCards = cards.filter((card) => card.raw && !card.error);
  if (!successfulCards.length) {
    const examples = failures.slice(0, 3).map((card) => `${card.ticker}: ${card.error}`).join(" | ");
    throw new Error(`All ticker fetches failed. ${examples || "Check network access and Yahoo availability."}`);
  }

  const ranked = rankMorningBriefResults(successfulCards, sortBy).slice(0, limit);
  const actionable = ranked.filter((card) => getActionability(card) > 0);
  const topResults = (actionable.length ? actionable : ranked).slice(0, topCount);
  const runTime = new Date().toISOString();

  return {
    source,
    sourceLabel,
    tickers,
    assetType,
    timeframe,
    confirmMode,
    confirmTimeframe,
    sortBy,
    topCount,
    limit,
    runTime,
    scannedCount: cards.length,
    failures,
    results: ranked,
    topResults,
    summaryPost: buildSummaryPost(ranked, sourceLabel, timeframe, confirmTimeframe),
    threadStarter: buildThreadStarter(topResults, timeframe),
    replyDrafts: topResults.map((card, index) => buildReply(card, index)),
  };
}
