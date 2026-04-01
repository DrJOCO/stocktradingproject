// Alert checking logic

import { fetchCandleData } from '../api/finnhub.js';
import { buildSignalCard } from '../indicators/scoring.js';
import { getAlerts, markAlertTriggered } from './storage.js';

/**
 * Check all active alerts against current market data.
 * Returns array of newly triggered alerts.
 */
export async function checkAlerts() {
  const alerts = getAlerts().filter(a => !a.triggered);
  if (!alerts.length) return [];

  const triggered = [];

  // Group by ticker to avoid duplicate fetches
  const byTicker = {};
  for (const a of alerts) {
    if (!byTicker[a.ticker]) byTicker[a.ticker] = [];
    byTicker[a.ticker].push(a);
  }

  for (const [ticker, tickerAlerts] of Object.entries(byTicker)) {
    try {
      const raw = await fetchCandleData(ticker, "1D", tickerAlerts[0].assetType || "US Stock");
      const card = buildSignalCard(ticker, "1D", raw);

      for (const alert of tickerAlerts) {
        let fire = false;

        switch (alert.type) {
          case "signal_change":
            if (alert.condition === "any_long" && card.signal.includes("LONG")) fire = true;
            if (alert.condition === "any_short" && card.signal.includes("SHORT")) fire = true;
            if (alert.condition === "strong_long" && card.signal === "STRONG LONG") fire = true;
            if (alert.condition === "strong_short" && card.signal === "STRONG SHORT") fire = true;
            break;

          case "rsi_cross":
            if (alert.direction === "above" && card.rsi > alert.level) fire = true;
            if (alert.direction === "below" && card.rsi < alert.level) fire = true;
            break;

          case "price_cross":
            if (alert.direction === "above" && card.entry > alert.level) fire = true;
            if (alert.direction === "below" && card.entry < alert.level) fire = true;
            break;

          case "score_threshold":
            if (card.score >= alert.level) fire = true;
            break;
        }

        if (fire) {
          markAlertTriggered(alert.id);
          triggered.push({
            ...alert,
            currentSignal: card.signal,
            currentScore: card.score,
            currentPrice: card.entry,
            currentRSI: card.rsi,
          });
        }
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      // Skip failed tickers silently
    }
  }

  return triggered;
}
