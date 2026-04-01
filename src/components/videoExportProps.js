export function buildSignalVideoProps(d, analysis) {
  return {
    ticker: d.ticker,
    signal: d.signal,
    confidence: d.confidence,
    score: d.score,
    entry: d.entry,
    stop: d.stop,
    target: d.target,
    stopPct: d.stopPct,
    tgtPct: d.tgtPct,
    rsi: d.rsi,
    macdDir: d.macdDir,
    adx: d.adx,
    vol: d.vol,
    atrPct: d.atrPct,
    aboveVWAP: d.aboveVWAP,
    supertrend: d.supertrend,
    commentary: analysis?.commentary || "",
    indicators: (d.indicators || []).slice(0, 6),
  };
}

export function buildLeaderboardVideoProps(results, scanTime) {
  return {
    title: "TOP SIGNALS",
    scanTime: scanTime ? scanTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
    results: results.slice(0, 10).map((r) => ({
      ticker: r.ticker,
      signal: r.signal,
      score: r.score,
      entry: r.entry,
    })),
  };
}

export function buildHeatmapVideoProps(sectors, scanTime) {
  return {
    scanTime: scanTime ? scanTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
    sectors: sectors.map((s) => ({
      name: s.name,
      etf: s.etf,
      score: s.score,
      change: s.change,
    })),
  };
}
