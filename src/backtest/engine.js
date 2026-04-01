// Walk-forward backtester with adaptive weight learning

import {
  ADAPTIVE_DEFAULT_WEIGHTS,
  scoreWithDirectionalStates,
} from '../indicators/scoreConfig.js';
import { buildSignalSnapshot } from '../indicators/scoring.js';

const MIN_LOOKBACK = 60;
const INDICATOR_NAMES = Object.keys(ADAPTIVE_DEFAULT_WEIGHTS);

function signalToDirection(signal) {
  if (signal.includes("LONG")) return "LONG";
  if (signal.includes("SHORT")) return "SHORT";
  return null;
}

function averageAlignment(trades, name, directionSign) {
  if (!trades.length) return 0;
  return trades.reduce((sum, trade) => {
    return sum + ((trade.indicatorState[name] || 0) * directionSign);
  }, 0) / trades.length;
}

/**
 * Run backtest AND learn which indicators predict well for this ticker.
 * Returns trades, stats, and adaptive weights.
 */
export function runBacktest(raw, atrMult = { stop: 1.8, target: 3.6 }) {
  const { closes: c, highs: h, lows: l, opens: o = raw.closes, volumes: v } = raw;
  if (c.length < MIN_LOOKBACK + 20) {
    return { trades: [], stats: null, adaptiveWeights: null, indicatorReport: null, error: "Not enough data" };
  }

  const trades = [];

  for (let i = MIN_LOOKBACK; i < c.length - 5; i += 3) {
    const sc = c.slice(0, i + 1);
    const sh = h.slice(0, i + 1);
    const sl = l.slice(0, i + 1);
    const so = o.slice(0, i + 1);
    const sv = v.slice(0, i + 1);
    const price = sc[sc.length - 1];

    const snapshot = buildSignalSnapshot({
      closes: sc,
      highs: sh,
      lows: sl,
      opens: so,
      volumes: sv,
      livePrice: price,
    });

    const direction = signalToDirection(snapshot.signal);
    if (!direction) continue;

    const { score, directionalStates: indicatorState, atrPct } = snapshot;
    const atrAbs = price * (atrPct / 100);
    const entry = price;
    const stop = direction === "LONG" ? entry - atrAbs * atrMult.stop : entry + atrAbs * atrMult.stop;
    const target = direction === "LONG" ? entry + atrAbs * atrMult.target : entry - atrAbs * atrMult.target;

    // Walk forward
    let outcome = "timeout", exitPrice = entry, exitBar = i;
    for (let j = i + 1; j < Math.min(i + 21, c.length); j++) {
      if (direction === "LONG") {
        if (l[j] <= stop) { outcome = "stop"; exitPrice = stop; exitBar = j; break; }
        if (h[j] >= target) { outcome = "target"; exitPrice = target; exitBar = j; break; }
      } else {
        if (h[j] >= stop) { outcome = "stop"; exitPrice = stop; exitBar = j; break; }
        if (l[j] <= target) { outcome = "target"; exitPrice = target; exitBar = j; break; }
      }
      exitPrice = c[j]; exitBar = j;
    }

    const pnlPct = direction === "LONG"
      ? (exitPrice - entry) / entry * 100
      : (entry - exitPrice) / entry * 100;

    trades.push({
      bar: i, direction, score, entry, stop, target,
      exitPrice, outcome, pnlPct: parseFloat(pnlPct.toFixed(2)),
      barsHeld: exitBar - i, indicatorState,
    });
  }

  const stats = computeStats(trades);
  const { adaptiveWeights, indicatorReport } = learnWeights(trades);

  return { trades, stats, adaptiveWeights, indicatorReport };
}

/**
 * Learn which directional indicators actually align with winning trades.
 * We score each indicator by comparing its directional alignment in wins vs losses,
 * then scale the base adaptive weight proportionally.
 */
function learnWeights(trades) {
  if (trades.length < 10) return { adaptiveWeights: ADAPTIVE_DEFAULT_WEIGHTS, indicatorReport: null };

  const longTrades = trades.filter(t => t.direction === "LONG");
  const shortTrades = trades.filter(t => t.direction === "SHORT");
  const longWins = longTrades.filter(t => t.pnlPct > 0);
  const longLosses = longTrades.filter(t => t.pnlPct <= 0);
  const shortWins = shortTrades.filter(t => t.pnlPct > 0);
  const shortLosses = shortTrades.filter(t => t.pnlPct <= 0);

  const report = {};
  const adaptiveWeights = {};

  for (const name of INDICATOR_NAMES) {
    const longWinAlign = averageAlignment(longWins, name, 1);
    const longLossAlign = averageAlignment(longLosses, name, 1);
    const shortWinAlign = averageAlignment(shortWins, name, -1);
    const shortLossAlign = averageAlignment(shortLosses, name, -1);

    const longEdge = longWinAlign - longLossAlign;
    const shortEdge = shortWinAlign - shortLossAlign;

    const availableEdges = [];
    if (longWins.length || longLosses.length) availableEdges.push(longEdge);
    if (shortWins.length || shortLosses.length) availableEdges.push(shortEdge);
    const combinedEdge = availableEdges.length
      ? availableEdges.reduce((sum, value) => sum + value, 0) / availableEdges.length
      : 0;

    const baseWeight = ADAPTIVE_DEFAULT_WEIGHTS[name] || 3;
    const multiplier = Math.max(0.25, Math.min(2.5, 1 + combinedEdge * 1.5));
    adaptiveWeights[name] = parseFloat((baseWeight * multiplier).toFixed(1));

    report[name] = {
      longWinPresence: Math.round(longWinAlign * 100),
      longLossPresence: Math.round(longLossAlign * 100),
      shortWinPresence: Math.round(shortWinAlign * 100),
      shortLossPresence: Math.round(shortLossAlign * 100),
      longEdge: parseFloat((longEdge * 100).toFixed(1)),
      shortEdge: parseFloat((shortEdge * 100).toFixed(1)),
      combinedEdge: parseFloat((combinedEdge * 100).toFixed(1)),
      defaultWeight: baseWeight,
      adaptiveWeight: adaptiveWeights[name],
      verdict: combinedEdge > 0.18 ? "STRONG PREDICTOR" :
               combinedEdge > 0.08 ? "USEFUL" :
               combinedEdge > -0.05 ? "NEUTRAL" :
               combinedEdge > -0.18 ? "WEAK" : "CONTRARIAN",
    };
  }

  return { adaptiveWeights, indicatorReport: report };
}

/**
 * Re-score using adaptive weights (call this from scoring.js)
 */
export function adaptiveScore(indicatorStates, weights) {
  return scoreWithDirectionalStates(50, indicatorStates, weights);
}

function computeStats(trades) {
  if (!trades.length) return null;
  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const longs = trades.filter(t => t.direction === "LONG");
  const shorts = trades.filter(t => t.direction === "SHORT");
  const totalPnl = trades.reduce((a, t) => a + t.pnlPct, 0);
  const winRate = (wins.length / trades.length) * 100;
  const avgWin = wins.length ? wins.reduce((a, t) => a + t.pnlPct, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, t) => a + t.pnlPct, 0) / losses.length) : 1;
  const profitFactor = avgLoss > 0 && losses.length > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;

  let peak = 0, maxDD = 0, cumPnl = 0;
  for (const t of trades) { cumPnl += t.pnlPct; if (cumPnl > peak) peak = cumPnl; const dd = peak - cumPnl; if (dd > maxDD) maxDD = dd; }

  const longWinRate = longs.length ? (longs.filter(t => t.pnlPct > 0).length / longs.length * 100) : 0;
  const shortWinRate = shorts.length ? (shorts.filter(t => t.pnlPct > 0).length / shorts.length * 100) : 0;
  const targets = trades.filter(t => t.outcome === "target").length;
  const stops = trades.filter(t => t.outcome === "stop").length;
  const timeouts = trades.filter(t => t.outcome === "timeout").length;

  return {
    totalTrades: trades.length, winRate: parseFloat(winRate.toFixed(1)),
    avgPnl: parseFloat((totalPnl / trades.length).toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(2)), avgLoss: parseFloat(avgLoss.toFixed(2)),
    profitFactor: parseFloat(Math.min(profitFactor, 99).toFixed(2)),
    maxDrawdown: parseFloat(maxDD.toFixed(2)),
    totalReturn: parseFloat(totalPnl.toFixed(2)),
    longWinRate: parseFloat(longWinRate.toFixed(1)), shortWinRate: parseFloat(shortWinRate.toFixed(1)),
    targets, stops, timeouts,
    longCount: longs.length, shortCount: shorts.length,
    avgBarsHeld: parseFloat((trades.reduce((a, t) => a + t.barsHeld, 0) / trades.length).toFixed(1)),
  };
}
