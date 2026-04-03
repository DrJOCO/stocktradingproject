// Market data fetching - Yahoo Finance via Vite proxies in dev and Vercel API routes in production

export const TF_MAP = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1H": "60m", "4H": "60m", "1D": "1d", "1W": "1wk",
};

// Yahoo range needed for each interval to get ~200+ candles
const RANGE_MAP = {
  "1m": "1d", "5m": "5d", "15m": "5d", "30m": "1mo",
  "60m": "6mo", "1d": "1y", "1wk": "5y",
};

const CRYPTO_YAHOO = {
  BTC: "BTC-USD", ETH: "ETH-USD", SOL: "SOL-USD",
  DOGE: "DOGE-USD", ADA: "ADA-USD", AVAX: "AVAX-USD",
  XRP: "XRP-USD", LINK: "LINK-USD", DOT: "DOT-USD",
  MATIC: "MATIC-USD", UNI: "UNI-USD",
};

function resolveYahooSymbol(ticker, assetType) {
  const sym = ticker.toUpperCase();
  if (assetType === "Crypto") {
    return CRYPTO_YAHOO[sym] || `${sym}-USD`;
  }
  return sym;
}

function buildChartUrl(symbol, params) {
  const search = new URLSearchParams(params);
  if (import.meta.env.DEV) {
    return `/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?${search.toString()}`;
  }

  search.set("symbol", symbol);
  return `/api/yahoo/chart?${search.toString()}`;
}

function buildQuoteSummaryUrl(symbol, modules) {
  const search = new URLSearchParams({ modules });
  if (import.meta.env.DEV) {
    return `/yahoo2/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?${search.toString()}`;
  }

  search.set("symbol", symbol);
  return `/api/yahoo/quote-summary?${search.toString()}`;
}

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 60_000;

export async function fetchCandleData(ticker, timeframe, assetType) {
  const interval = TF_MAP[timeframe] || "1d";
  const range = RANGE_MAP[interval] || "1y";
  const symbol = resolveYahooSymbol(ticker, assetType);

  const cacheKey = `${symbol}:${interval}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const url = buildChartUrl(symbol, { range, interval, includePrePost: "false" });
  const res = await fetch(url);

  if (res.status === 429) throw new Error("Rate limited — wait a moment and try again.");
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${ticker}. Check the symbol.`);

  const quotes = result.indicators?.quote?.[0];
  if (!quotes?.close || quotes.close.length < 20) {
    throw new Error(`Insufficient data for ${ticker} on ${timeframe}.`);
  }

  // Yahoo sometimes has null values — fill forward
  const closes = [], highs = [], lows = [], opens = [], volumes = [], timestamps = [];
  let lastC = 0, lastH = 0, lastL = 0, lastO = 0;
  for (let i = 0; i < quotes.close.length; i++) {
    const c = quotes.close[i] ?? lastC;
    const h = quotes.high[i] ?? lastH;
    const l = quotes.low[i] ?? lastL;
    const o = quotes.open[i] ?? lastO;
    const v = quotes.volume[i] ?? 0;
    if (c > 0) { // skip zero/null rows
      closes.push(c); highs.push(h); lows.push(l); opens.push(o); volumes.push(v);
      timestamps.push(result.timestamp?.[i] ? new Date(result.timestamp[i] * 1000).toISOString() : null);
      lastC = c; lastH = h; lastL = l; lastO = o;
    }
  }

  if (closes.length < 20) throw new Error(`Not enough valid candles for ${ticker}.`);

  const livePrice = result.meta?.regularMarketPrice || closes[closes.length - 1];

  const data = { closes, highs, lows, opens, volumes, timestamps, livePrice };
  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// Batch fetch multiple tickers
export async function fetchMultiple(tickers, timeframe, assetType) {
  const results = [];
  for (let i = 0; i < tickers.length; i++) {
    try {
      const data = await fetchCandleData(tickers[i], timeframe, assetType);
      results.push({ ticker: tickers[i], data, error: null });
    } catch (e) {
      results.push({ ticker: tickers[i], data: null, error: e.message });
    }
    if (i < tickers.length - 1) await new Promise(r => setTimeout(r, 150));
  }
  return results;
}


// Fetch extended data for backtesting (5 years daily)
export async function fetchBacktestData(ticker, assetType) {
  const symbol = resolveYahooSymbol(ticker, assetType);
  const cacheKey = `bt5:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL * 5) return cached.data;

  const url = buildChartUrl(symbol, { range: "5y", interval: "1d", includePrePost: "false" });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${ticker}`);
  const quotes = result.indicators?.quote?.[0];
  if (!quotes?.close) throw new Error(`No candle data for ${ticker}`);

  const closes = [], highs = [], lows = [], opens = [], volumes = [], timestamps = [];
  let lastC = 0, lastH = 0, lastL = 0, lastO = 0;
  for (let i = 0; i < quotes.close.length; i++) {
    const c = quotes.close[i] ?? lastC;
    const h = quotes.high[i] ?? lastH;
    const l = quotes.low[i] ?? lastL;
    const o = quotes.open[i] ?? lastO;
    const v = quotes.volume[i] ?? 0;
    if (c > 0) {
      closes.push(c); highs.push(h); lows.push(l); opens.push(o); volumes.push(v);
      timestamps.push(result.timestamp?.[i] ? new Date(result.timestamp[i] * 1000).toISOString() : null);
      lastC = c; lastH = h; lastL = l; lastO = o;
    }
  }

  const livePrice = result.meta?.regularMarketPrice || closes[closes.length - 1];
  const data = { closes, highs, lows, opens, volumes, timestamps, livePrice };
  cache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// Fetch earnings calendar for a ticker
export async function fetchEarnings(ticker, assetType) {
  if (assetType === "Crypto") return null; // crypto doesn't have earnings
  const symbol = resolveYahooSymbol(ticker, assetType);
  const cacheKey = `earn:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL * 10) return cached.data;

  try {
    // Yahoo Finance calendar events endpoint
    const url = buildChartUrl(symbol, {
      range: "3mo",
      interval: "1d",
      includePrePost: "false",
      events: "earnings",
    });
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const events = result?.events?.earnings;

    // Also try the quote summary for next earnings date
    let nextEarningsDate = null;
    let nextEarningsEst = null;
    try {
      const qUrl = buildQuoteSummaryUrl(symbol, "calendarEvents,earnings");
      const qRes = await fetch(qUrl);
      if (qRes.ok) {
        const qJson = await qRes.json();
        const cal = qJson?.quoteSummary?.result?.[0]?.calendarEvents;
        const earningsData = qJson?.quoteSummary?.result?.[0]?.earnings;
        if (cal?.earnings?.earningsDate?.length > 0) {
          nextEarningsDate = new Date(cal.earnings.earningsDate[0].raw * 1000);
          nextEarningsEst = cal.earnings.earningsAverage?.raw;
        }
        // Get quarterly history
        var quarterlyHistory = earningsData?.earningsChart?.quarterly?.map(q => ({
          quarter: q.date,
          actual: q.actual?.raw,
          estimate: q.estimate?.raw,
          beat: q.actual?.raw > q.estimate?.raw,
        })) || [];
      }
    } catch (summaryError) {
      void summaryError;
    }

    // Parse historical earnings from chart events
    const historicalEarnings = [];
    if (events) {
      for (const [ts, ev] of Object.entries(events)) {
        historicalEarnings.push({
          date: new Date(Number(ts) * 1000),
          actual: ev.epsActual,
          estimate: ev.epsEstimate,
          beat: ev.epsActual > ev.epsEstimate,
          surprise: ev.epsDifference,
          surprisePct: ev.surprisePercent,
        });
      }
      historicalEarnings.sort((a, b) => b.date - a.date);
    }

    // Calculate days until next earnings
    let daysUntil = null;
    if (nextEarningsDate) {
      daysUntil = Math.ceil((nextEarningsDate - new Date()) / (1000 * 60 * 60 * 24));
    }

    // Earnings streak
    const recentBeats = (quarterlyHistory || []).filter(q => q.beat).length;
    const totalRecent = (quarterlyHistory || []).length;

    const data = {
      nextDate: nextEarningsDate,
      daysUntil,
      nextEstimate: nextEarningsEst,
      history: historicalEarnings,
      quarterly: quarterlyHistory || [],
      beatRate: totalRecent > 0 ? Math.round((recentBeats / totalRecent) * 100) : null,
      beatStreak: recentBeats,
      isUpcoming: daysUntil !== null && daysUntil >= 0 && daysUntil <= 14,
      isImminent: daysUntil !== null && daysUntil >= 0 && daysUntil <= 3,
    };

    cache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}
