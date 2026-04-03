import { runMorningBrief } from "../src/lib/morningBrief.js";

const DEFAULT_SOURCE = "Mega Cap Tech";
const DEFAULT_TIMEFRAME = process.env.MORNING_TIMEFRAME || "1D";
const DEFAULT_CONFIRM_MODE = process.env.MORNING_CONFIRM_MODE || "AUTO";
const DEFAULT_TOP_COUNT = Number(process.env.MORNING_TOP_COUNT || 3);
const DEFAULT_LIMIT = Number(process.env.MORNING_RESULT_LIMIT || 10);
const SLEEP_MS = Number(process.env.MORNING_SLEEP_MS || 150);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function printSection(title) {
  console.log(`\n## ${title}`);
}

function printUsage() {
  console.log(`Morning Brief

Usage:
  npm run morning-brief
  npm run morning-brief -- --watchlist "Mega Cap Tech"
  npm run morning-brief -- --tickers AAPL,MSFT,NVDA

Optional env vars:
  MORNING_WATCHLIST
  MORNING_TICKERS
  MORNING_TIMEFRAME
  MORNING_CONFIRM_MODE
  MORNING_TOP_COUNT
  MORNING_RESULT_LIMIT
  MORNING_SLEEP_MS
  MORNING_PROXY_BASE_URL
`);
}

async function main() {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }

  const source = getArgValue("--watchlist") || process.env.MORNING_WATCHLIST || DEFAULT_SOURCE;
  const customTickers = getArgValue("--tickers") || process.env.MORNING_TICKERS || "";
  const timeframe = getArgValue("--timeframe") || DEFAULT_TIMEFRAME;
  const confirmMode = getArgValue("--confirm") || DEFAULT_CONFIRM_MODE;
  const sortBy = getArgValue("--sort") || "score";

  const brief = await runMorningBrief({
    source,
    customTickers,
    timeframe,
    confirmMode,
    sortBy,
    topCount: DEFAULT_TOP_COUNT,
    limit: DEFAULT_LIMIT,
    sleepMs: SLEEP_MS,
  });

  console.log(`# Morning Brief`);
  console.log(`Source: ${brief.sourceLabel}`);
  console.log(`Universe: ${brief.tickers.join(", ")}`);
  console.log(`Timeframe: ${brief.timeframe}${brief.confirmTimeframe ? ` with ${brief.confirmTimeframe} confirmation` : ""}`);
  console.log(`Scanned: ${brief.scannedCount} | Ranked: ${brief.results.length} | Failed: ${brief.failures.length}`);

  if (brief.failures.length) {
    printSection("Fetch Failures");
    brief.failures.forEach((card, index) => {
      console.log(`${index + 1}. ${card.ticker} | ${card.error}`);
    });
  }

  printSection("Top Results");
  brief.results.forEach((card, index) => {
    console.log(`${index + 1}. ${card.ticker} | ${card.signal} | Score ${card.score} | Conf ${card.confidence}% | Entry $${card.entry} | ${card.mtf?.status || "OFF"}`);
  });

  if (!brief.results.length) {
    console.log("No clean setups made it through ranking. Try a broader universe, different timeframe, or confirmation mode OFF.");
  }

  printSection("X Draft 1 — Screener Summary");
  console.log(brief.summaryPost);
  console.log(`Chars: ${brief.summaryPost.length}`);

  printSection("X Draft 2 — Top 3 Thread Starter");
  console.log(brief.threadStarter);
  console.log(`Chars: ${brief.threadStarter.length}`);

  printSection("Top 3 Analysis");
  brief.topResults.forEach((card, index) => {
    console.log(`${index + 1}. ${card.ticker}`);
    console.log(`   Signal: ${card.signal} | Score ${card.score} | Confidence ${card.confidence}%`);
    console.log(`   Narrative: ${card.analysis?.heroLead || card.analysis?.summary || "No narrative available."}`);
    console.log(`   Plan: ${card.analysis?.suggestion || "No plan generated."}`);
  });

  printSection("X Draft Replies");
  brief.replyDrafts.forEach((reply, index) => {
    console.log(`Reply ${index + 1}: ${reply}`);
    console.log(`Chars: ${reply.length}`);
  });
}

main().catch((error) => {
  console.error(`Morning brief failed: ${error.message}`);
  process.exitCode = 1;
});
