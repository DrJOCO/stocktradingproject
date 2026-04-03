import { fetchCandleData } from "../src/api/finnhub.js";
import { buildSignalCard } from "../src/indicators/scoring.js";
import { reviewOteTriggers } from "../src/indicators/oteReview.js";

const BUILTIN_WATCHLISTS = {
  "mega-cap-tech": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA"],
  etfs: ["SPY", "QQQ", "IWM", "DIA", "XLF", "XLE", "XLK", "GLD", "TLT"],
  crypto: ["BTC", "ETH", "SOL", "XRP", "ADA", "AVAX", "LINK", "DOT"],
  growth: ["PLTR", "SNOW", "CRWD", "DDOG", "NET", "ZS", "MDB"],
  "value-dividend": ["JPM", "V", "JNJ", "PG", "KO", "PFE", "CVX"],
};

const DEFAULT_SOURCE = "mega-cap-tech";
const DEFAULT_TIMEFRAME = process.env.MORNING_TIMEFRAME || "1D";
const DEFAULT_CONFIRM_MODE = process.env.MORNING_CONFIRM_MODE || "AUTO";
const DEFAULT_TOP_COUNT = Number(process.env.MORNING_TOP_COUNT || 3);
const DEFAULT_LIMIT = Number(process.env.MORNING_RESULT_LIMIT || 10);
const SLEEP_MS = Number(process.env.MORNING_SLEEP_MS || 150);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function resolveConfirmTimeframe(primaryTimeframe, confirmMode) {
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

async function buildScreenedCard(ticker, timeframe, assetType, confirmTimeframe) {
  const raw = await fetchCandleData(ticker, timeframe, assetType);
  const card = buildSignalCard(ticker, timeframe, raw);

  if (!confirmTimeframe) {
    return { ...card, mtf: buildMtfState(card.signal, null, null), raw };
  }

  try {
    const confirmRaw = await fetchCandleData(ticker, confirmTimeframe, assetType);
    const confirmCard = buildSignalCard(ticker, confirmTimeframe, confirmRaw);
    return {
      ...card,
      mtf: buildMtfState(card.signal, confirmCard.signal, confirmTimeframe),
      raw,
    };
  } catch (error) {
    return {
      ...card,
      mtf: buildMtfState(card.signal, null, confirmTimeframe, error.message),
      raw,
    };
  }
}

function parseTickers(rawValue) {
  return rawValue
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean);
}

function resolveUniverse() {
  const explicitTickers = getArgValue("--tickers") || process.env.MORNING_TICKERS || "";
  if (explicitTickers.trim()) {
    return {
      label: "CUSTOM",
      tickers: parseTickers(explicitTickers),
      assetType: "US Stock",
    };
  }

  const source = (getArgValue("--watchlist") || process.env.MORNING_WATCHLIST || DEFAULT_SOURCE).toLowerCase();
  const tickers = BUILTIN_WATCHLISTS[source] || BUILTIN_WATCHLISTS[DEFAULT_SOURCE];
  const assetType = source === "crypto" ? "Crypto" : source === "etfs" ? "ETF" : "US Stock";
  return {
    label: source.toUpperCase(),
    tickers,
    assetType,
  };
}

function rankResults(results, sortBy = "score") {
  return [...results].sort((a, b) => {
    if (sortBy === "confidence") return (b.confidence || 0) - (a.confidence || 0);
    if (sortBy === "rsi") return (a.rsi || 50) - (b.rsi || 50);
    if (sortBy === "volume") return (b.vol || 0) - (a.vol || 0);
    if (sortBy === "mtf") {
      const mtfDiff = (MTF_SORT_RANK[b.mtf?.status || "OFF"] || 0) - (MTF_SORT_RANK[a.mtf?.status || "OFF"] || 0);
      if (mtfDiff !== 0) return mtfDiff;
      return (b.score || 0) - (a.score || 0);
    }
    return (b.score || 0) - (a.score || 0);
  });
}

function shortSignal(signal) {
  return signal
    .replace("STRONG ", "S ")
    .replace("LONG BIAS", "LONG")
    .replace("SHORT BIAS", "SHORT");
}

function summarizeOte(card) {
  try {
    const review = reviewOteTriggers(card.raw);
    const latest = review.latestTriggered || review.latest;
    if (!latest) return "No recent valid OTE review.";
    if (!latest.entryPrice) return `${latest.direction} OTE touch, no trigger.`;
    return `${latest.direction} OTE triggered; best exit ${latest.bestRuleExit?.label || "n/a"} ${latest.bestRuleExit?.pnlPct >= 0 ? "+" : ""}${latest.bestRuleExit?.pnlPct ?? 0}%.`;
  } catch {
    return "OTE review unavailable.";
  }
}

function clampPost(text, max = 280) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function buildSummaryPost(results, sourceLabel, timeframe, confirmTimeframe) {
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

function buildThreadStarter(results, timeframe) {
  const top = results.slice(0, 3).map((item) => `${item.ticker} ${shortSignal(item.signal)} S${item.score}/C${item.confidence}%`).join(" • ") || "none qualified today";
  return clampPost(`Top 3 ${timeframe} setups from this morning’s screen: ${top}. Quick trade-plan notes below. #stocks #swingtrading`);
}

function buildReply(card, index) {
  const lineOne = `${index + 1}/3 ${card.ticker} ${card.timeframe}: ${card.signal} (S${card.score}/C${card.confidence}%).`;
  const lineTwo = `Plan: entry $${card.entry}, stop $${card.stop}, target $${card.target}.`;
  const lineThree = `${card.analysis?.heroLead || card.analysis?.summary || "Mixed signal stack."} ${summarizeOte(card)}`;
  return clampPost(`${lineOne} ${lineTwo} ${lineThree} #stocks`);
}

function printSection(title) {
  console.log(`\n## ${title}`);
}

function printFailures(failures) {
  if (!failures.length) return;
  printSection("Fetch Failures");
  failures.forEach((card, index) => {
    console.log(`${index + 1}. ${card.ticker} | ${card.error}`);
  });
}

function printUsage() {
  console.log(`Morning Brief

Usage:
  npm run morning-brief
  npm run morning-brief -- --watchlist mega-cap-tech
  npm run morning-brief -- --tickers AAPL,MSFT,NVDA

Optional env vars:
  MORNING_WATCHLIST
  MORNING_TICKERS
  MORNING_TIMEFRAME
  MORNING_CONFIRM_MODE
  MORNING_TOP_COUNT
  MORNING_RESULT_LIMIT
  MORNING_SLEEP_MS
`);
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const { label, tickers, assetType } = resolveUniverse();
  const timeframe = getArgValue("--timeframe") || DEFAULT_TIMEFRAME;
  const confirmMode = getArgValue("--confirm") || DEFAULT_CONFIRM_MODE;
  const confirmTimeframe = resolveConfirmTimeframe(timeframe, confirmMode);
  const sortBy = getArgValue("--sort") || "score";

  if (!tickers.length) {
    throw new Error("No tickers configured for the morning brief.");
  }

  const cards = [];
  for (let index = 0; index < tickers.length; index++) {
    try {
      cards.push(await buildScreenedCard(tickers[index], timeframe, assetType, confirmTimeframe));
    } catch (error) {
      cards.push({
        ticker: tickers[index],
        timeframe,
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
    if (index < tickers.length - 1) await sleep(SLEEP_MS);
  }

  const failures = cards.filter((card) => card.error);
  const successfulCards = cards.filter((card) => card.raw && !card.error);
  if (!successfulCards.length) {
    const examples = failures.slice(0, 3).map((card) => `${card.ticker}: ${card.error}`).join(" | ");
    throw new Error(`All ticker fetches failed. ${examples || "Check network access and Yahoo availability."}`);
  }

  const ranked = rankResults(successfulCards, sortBy).slice(0, DEFAULT_LIMIT);
  const topThree = ranked.slice(0, DEFAULT_TOP_COUNT);

  console.log(`# Morning Brief`);
  console.log(`Source: ${label}`);
  console.log(`Universe: ${tickers.join(", ")}`);
  console.log(`Timeframe: ${timeframe}${confirmTimeframe ? ` with ${confirmTimeframe} confirmation` : ""}`);
  console.log(`Scanned: ${cards.length} | Ranked: ${ranked.length} | Failed: ${failures.length}`);

  printFailures(failures);

  printSection("Top Results");
  ranked.forEach((card, index) => {
    console.log(`${index + 1}. ${card.ticker} | ${card.signal} | Score ${card.score} | Conf ${card.confidence}% | Entry $${card.entry} | ${card.mtf?.status || "OFF"}`);
  });

  if (!ranked.length) {
    console.log("No clean setups made it through ranking. Try a broader universe, different timeframe, or confirmation mode OFF.");
  }

  printSection("X Draft 1 — Screener Summary");
  const summaryPost = buildSummaryPost(ranked, label, timeframe, confirmTimeframe);
  console.log(summaryPost);
  console.log(`Chars: ${summaryPost.length}`);

  printSection("X Draft 2 — Top 3 Thread Starter");
  const threadStarter = buildThreadStarter(topThree, timeframe);
  console.log(threadStarter);
  console.log(`Chars: ${threadStarter.length}`);

  printSection("Top 3 Analysis");
  topThree.forEach((card, index) => {
    console.log(`${index + 1}. ${card.ticker}`);
    console.log(`   Signal: ${card.signal} | Score ${card.score} | Confidence ${card.confidence}%`);
    console.log(`   Narrative: ${card.analysis?.heroLead || card.analysis?.summary || "No narrative available."}`);
    console.log(`   Plan: ${card.analysis?.suggestion || "No plan generated."}`);
    console.log(`   OTE: ${summarizeOte(card)}`);
  });

  printSection("X Draft Replies");
  topThree.forEach((card, index) => {
    const reply = buildReply(card, index);
    console.log(`Reply ${index + 1}: ${reply}`);
    console.log(`Chars: ${reply.length}`);
  });
}

main().catch((error) => {
  console.error(`Morning brief failed: ${error.message}`);
  process.exitCode = 1;
});
