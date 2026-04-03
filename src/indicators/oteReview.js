import { calcOTE } from "./advanced.js";
import { buildSignalSnapshot } from "./scoring.js";

const REVIEW_LOOKAHEAD = 20;
const ENTRY_CONFIRM_BARS = 4;
const MAX_REVIEWS = 6;
const MIN_TRIGGER_CONFIRMATIONS = 2;
const REVIEW_TIMEFRAME_MAP = {
  "1m": "15m",
  "5m": "30m",
  "15m": "1H",
  "30m": "4H",
  "1H": "4H",
  "4H": "1D",
  "1D": "1W",
  "1W": null,
};

function directionSign(direction) {
  return direction === "LONG" ? 1 : -1;
}

function pctMove(direction, from, to) {
  const sign = directionSign(direction);
  return parseFloat((((to - from) / from) * 100 * sign).toFixed(2));
}

function moveFromEntry(direction, entryPrice, observedPrice) {
  if (!entryPrice) return 0;
  if (direction === "LONG") return ((observedPrice - entryPrice) / entryPrice) * 100;
  return ((entryPrice - observedPrice) / entryPrice) * 100;
}

function formatRuleName(name) {
  return {
    ema21Loss: "EMA21 loss",
    supertrendFlip: "Supertrend flip",
    rollingVwapLoss: "Rolling VWAP loss",
    macdCross: "MACD cross",
    cmfTurn: "CMF turn",
    trendDefense: "EMA21 / Supertrend defense",
  }[name] || name;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getOteReviewTimeframes(timeframe) {
  if (!timeframe) return [];
  return [...new Set([timeframe, REVIEW_TIMEFRAME_MAP[timeframe]].filter(Boolean))];
}

function makeSnapshotGetter(raw) {
  const cache = new Map();
  return (index) => {
    if (cache.has(index)) return cache.get(index);
    const snapshot = buildSignalSnapshot({
      closes: raw.closes.slice(0, index + 1),
      highs: raw.highs.slice(0, index + 1),
      lows: raw.lows.slice(0, index + 1),
      opens: (raw.opens || raw.closes).slice(0, index + 1),
      volumes: raw.volumes.slice(0, index + 1),
      livePrice: raw.closes[index],
    });
    cache.set(index, snapshot);
    return snapshot;
  };
}

function getStopTarget(ote, direction) {
  if (!ote?.range) return { stop: null, target: null };
  if (direction === "LONG") {
    return {
      stop: ote.swingHigh - ote.range * 0.79,
      target: ote.swingHigh,
    };
  }

  return {
    stop: ote.swingLow + ote.range * 0.79,
    target: ote.swingLow,
  };
}

function scoreTriggerCandidate(raw, index, ote, direction, getSnapshot) {
  if (index <= 0) return null;

  const snapshot = getSnapshot(index);
  const close = raw.closes[index];
  const open = (raw.opens || raw.closes)[index];
  const high = raw.highs[index];
  const low = raw.lows[index];
  const prevOpen = (raw.opens || raw.closes)[index - 1];
  const prevClose = raw.closes[index - 1];
  const prevHigh = raw.highs[index - 1];
  const prevLow = raw.lows[index - 1];
  const range = Math.max(high - low, 0.0001);
  const body = Math.abs(close - open);
  const bodyPct = body / range;
  const sweetSpot = direction === "LONG"
    ? ote.swingHigh - ote.range * 0.705
    : ote.swingLow + ote.range * 0.705;
  const touchedZone = direction === "LONG"
    ? low <= ote.oteTop && high >= ote.oteBottom
    : high >= ote.oteBottom && low <= ote.oteTop;
  const rejectionCandle = direction === "LONG"
    ? close > open && close >= low + range * 0.6
    : close < open && close <= high - range * 0.6;
  const reclaimedSweetSpot = direction === "LONG" ? close >= sweetSpot : close <= sweetSpot;
  const engulfing = direction === "LONG"
    ? close > Math.max(prevOpen, prevClose) && open <= prevClose
    : close < Math.min(prevOpen, prevClose) && open >= prevClose;
  const brokePriorTriggerBar = direction === "LONG" ? close > prevHigh : close < prevLow;

  const confirmations = [
    { label: direction === "LONG" ? "MACD bullish" : "MACD bearish", pass: direction === "LONG" ? snapshot.macd.bullish : !snapshot.macd.bullish },
    { label: direction === "LONG" ? "CMF supportive" : "CMF distributive", pass: direction === "LONG" ? snapshot.cmf >= 0 : snapshot.cmf <= 0 },
    { label: direction === "LONG" ? "Heikin Ashi bullish" : "Heikin Ashi bearish", pass: direction === "LONG" ? snapshot.heikinAshi.trend === "bullish" : snapshot.heikinAshi.trend === "bearish" },
    { label: direction === "LONG" ? "Rolling VWAP reclaimed" : "Rolling VWAP lost", pass: direction === "LONG" ? snapshot.aboveVWAP : !snapshot.aboveVWAP },
    { label: direction === "LONG" ? "RSI constructive" : "RSI weakening", pass: direction === "LONG" ? snapshot.rsi >= 45 : snapshot.rsi <= 55 },
    {
      label: direction === "LONG" ? "DMI aligned" : "DMI aligned",
      pass: direction === "LONG" ? snapshot.adxFull.plusDI >= snapshot.adxFull.minusDI : snapshot.adxFull.minusDI >= snapshot.adxFull.plusDI,
    },
  ];
  const passed = confirmations.filter(item => item.pass);

  let score = 0;
  if (touchedZone) score += 20;
  if (rejectionCandle) score += 20;
  if (reclaimedSweetSpot) score += 15;
  if (engulfing) score += 10;
  if (brokePriorTriggerBar) score += 10;
  if (bodyPct >= 0.45) score += 10;
  score += passed.length * 6;
  const quality = clamp(Math.round(score), 0, 100);
  const valid = touchedZone && rejectionCandle && (reclaimedSweetSpot || engulfing || brokePriorTriggerBar) && passed.length >= MIN_TRIGGER_CONFIRMATIONS;

  return {
    valid,
    quality,
    confirmations: passed.map(item => item.label),
    confirmationCount: passed.length,
    candle: engulfing
      ? (direction === "LONG" ? "bullish engulfing / reclaim" : "bearish engulfing / reject")
      : rejectionCandle
      ? (direction === "LONG" ? "bullish rejection candle" : "bearish rejection candle")
      : "no trigger candle",
    close,
    snapshot,
  };
}

function getEntryTrigger(raw, startIndex, ote, direction, lastIndex, getSnapshot) {
  for (let index = startIndex; index <= Math.min(startIndex + ENTRY_CONFIRM_BARS, lastIndex); index++) {
    const candidate = scoreTriggerCandidate(raw, index, ote, direction, getSnapshot);
    if (candidate?.valid) {
      return {
        index,
        price: raw.closes[index],
        quality: candidate.quality,
        confirmations: candidate.confirmations,
        confirmationCount: candidate.confirmationCount,
        candle: candidate.candle,
      };
    }
  }
  return null;
}

function evaluateOutcome(raw, entryIndex, entryPrice, direction, stop, target, lastIndex) {
  let maxFavorable = Number.NEGATIVE_INFINITY;
  let maxAdverse = Number.NEGATIVE_INFINITY;
  let targetHit = false;
  let stopHit = false;
  let exitIndex = Math.min(entryIndex + REVIEW_LOOKAHEAD, lastIndex);
  let closeAtWindow = raw.closes[exitIndex];
  let outcome = "open";

  for (let index = entryIndex + 1; index <= Math.min(entryIndex + REVIEW_LOOKAHEAD, lastIndex); index++) {
    const high = raw.highs[index];
    const low = raw.lows[index];
    if (direction === "LONG") {
      maxFavorable = Math.max(maxFavorable, moveFromEntry(direction, entryPrice, high));
      maxAdverse = Math.max(maxAdverse, Math.max(0, -moveFromEntry(direction, entryPrice, low)));
      if (!stopHit && low <= stop) {
        stopHit = true;
        outcome = "failed";
        exitIndex = index;
        closeAtWindow = stop;
        break;
      }
      if (!targetHit && high >= target) {
        targetHit = true;
        outcome = "target";
        exitIndex = index;
        closeAtWindow = target;
        break;
      }
    } else {
      maxFavorable = Math.max(maxFavorable, moveFromEntry(direction, entryPrice, low));
      maxAdverse = Math.max(maxAdverse, Math.max(0, -moveFromEntry(direction, entryPrice, high)));
      if (!stopHit && high >= stop) {
        stopHit = true;
        outcome = "failed";
        exitIndex = index;
        closeAtWindow = stop;
        break;
      }
      if (!targetHit && low <= target) {
        targetHit = true;
        outcome = "target";
        exitIndex = index;
        closeAtWindow = target;
        break;
      }
    }
    closeAtWindow = raw.closes[index];
    if (index === Math.min(entryIndex + REVIEW_LOOKAHEAD, lastIndex)) {
      outcome = pctMove(direction, entryPrice, closeAtWindow) >= 0 ? "open-profit" : "open-loss";
      exitIndex = index;
    }
  }

  return {
    outcome,
    targetHit,
    stopHit,
    barsObserved: exitIndex - entryIndex,
    closeAfterWindow: parseFloat(closeAtWindow.toFixed(2)),
    closeReturnPct: pctMove(direction, entryPrice, closeAtWindow),
    maxFavorablePct: maxFavorable === Number.NEGATIVE_INFINITY ? 0 : parseFloat(maxFavorable.toFixed(2)),
    maxAdversePct: maxAdverse === Number.NEGATIVE_INFINITY ? 0 : parseFloat(maxAdverse.toFixed(2)),
  };
}

function buildExitRules(direction) {
  return {
    ema21Loss: (snapshot, close) => direction === "LONG" ? snapshot.ema21 && close < snapshot.ema21 : snapshot.ema21 && close > snapshot.ema21,
    supertrendFlip: (snapshot) => direction === "LONG" ? !snapshot.supertrend.bullish : snapshot.supertrend.bullish,
    rollingVwapLoss: (snapshot) => direction === "LONG" ? !snapshot.aboveVWAP : snapshot.aboveVWAP,
    macdCross: (snapshot) => direction === "LONG" ? !snapshot.macd.bullish : snapshot.macd.bullish,
    cmfTurn: (snapshot) => direction === "LONG" ? snapshot.cmf < 0 : snapshot.cmf > 0,
    trendDefense: (snapshot, close) => direction === "LONG"
      ? (snapshot.ema21 && close < snapshot.ema21) || !snapshot.supertrend.bullish
      : (snapshot.ema21 && close > snapshot.ema21) || snapshot.supertrend.bullish,
  };
}

function evaluateExitRules(raw, entryIndex, entryPrice, direction, stop, lastIndex, getSnapshot) {
  const rules = buildExitRules(direction);
  const evaluations = [];
  const horizon = Math.min(entryIndex + REVIEW_LOOKAHEAD, lastIndex);

  for (const [name, predicate] of Object.entries(rules)) {
    let exitIndex = horizon;
    let exitPrice = raw.closes[horizon];
    let reason = "window close";

    for (let index = entryIndex + 1; index <= horizon; index++) {
      if (direction === "LONG" && raw.lows[index] <= stop) {
        exitIndex = index;
        exitPrice = stop;
        reason = "hard stop";
        break;
      }

      if (direction === "SHORT" && raw.highs[index] >= stop) {
        exitIndex = index;
        exitPrice = stop;
        reason = "hard stop";
        break;
      }

      const snapshot = getSnapshot(index);
      const close = raw.closes[index];
      if (predicate(snapshot, close)) {
        exitIndex = index;
        exitPrice = close;
        reason = formatRuleName(name);
        break;
      }
    }

    evaluations.push({
      rule: name,
      label: formatRuleName(name),
      exitIndex,
      exitPrice: parseFloat(exitPrice.toFixed(2)),
      pnlPct: pctMove(direction, entryPrice, exitPrice),
      barsHeld: exitIndex - entryIndex,
      reason,
    });
  }

  return evaluations.sort((a, b) => b.pnlPct - a.pnlPct);
}

function buildReview(raw, zoneIndex, ote, entryTrigger, getSnapshot) {
  const direction = ote.direction;
  const { stop, target } = getStopTarget(ote, direction);
  if (stop == null || target == null) return null;

  const outcome = evaluateOutcome(raw, entryTrigger.index, entryTrigger.price, direction, stop, target, raw.closes.length - 1);
  const exits = evaluateExitRules(raw, entryTrigger.index, entryTrigger.price, direction, stop, raw.closes.length - 1, getSnapshot);
  const bestRule = exits[0] || null;
  const nonLosing = exits.filter(exit => exit.pnlPct >= 0).sort((a, b) => a.barsHeld - b.barsHeld || b.pnlPct - a.pnlPct);
  const defensiveRule = nonLosing[0] || exits[0] || null;

  return {
    id: `${direction}_${entryTrigger.index}_${Math.round(entryTrigger.price * 100)}`,
    direction,
    zoneIndex,
    zoneDate: raw.timestamps?.[zoneIndex] || null,
    entryIndex: entryTrigger.index,
    entryDate: raw.timestamps?.[entryTrigger.index] || null,
    entryPrice: parseFloat(entryTrigger.price.toFixed(2)),
    triggerQuality: entryTrigger.quality,
    triggerConfirmations: entryTrigger.confirmations,
    triggerConfirmationCount: entryTrigger.confirmationCount,
    triggerCandle: entryTrigger.candle,
    stop: parseFloat(stop.toFixed(2)),
    target: parseFloat(target.toFixed(2)),
    oteTop: ote.oteTop,
    oteBottom: ote.oteBottom,
    swingHigh: ote.swingHigh,
    swingLow: ote.swingLow,
    retracementPct: ote.retracementPct,
    hasFVG: ote.hasFVG,
    validStructureBreak: ote.validStructureBreak,
    outcome,
    bestRuleExit: bestRule,
    defensiveRuleExit: defensiveRule,
    exitRules: exits,
    narrative: outcome.targetHit
      ? `OTE trigger worked. Price reclaimed the impulse leg before invalidation and reached the breakout objective.`
      : outcome.stopHit
      ? `OTE trigger failed. Price invalidated below the zone before reclaiming the prior swing.`
      : `OTE trigger fired and stayed active through the review window without a clean target or hard failure.`,
  };
}

export function summarizeExitPerformance(reviews) {
  const triggered = reviews.filter(review => review.entryPrice != null && review.exitRules?.length);
  const defensiveSetups = triggered.filter(review => review.outcome?.stopHit || (review.outcome?.closeReturnPct ?? 0) < 0);
  const defensiveIds = new Set(defensiveSetups.map(review => review.id));
  const byRule = new Map();

  for (const review of triggered) {
    const maxRun = review.outcome?.maxFavorablePct ?? 0;
    for (const exit of review.exitRules) {
      const current = byRule.get(exit.rule) || {
        rule: exit.rule,
        label: exit.label,
        count: 0,
        wins: 0,
        totalPnl: 0,
        totalBars: 0,
        captureRateSum: 0,
        defensiveCount: 0,
        defensivePnl: 0,
        defensiveImprovement: 0,
      };

      current.count += 1;
      current.totalPnl += exit.pnlPct;
      current.totalBars += exit.barsHeld;
      if (exit.pnlPct > 0) current.wins += 1;
      current.captureRateSum += maxRun > 0 ? clamp(exit.pnlPct / maxRun, 0, 1) : exit.pnlPct > 0 ? 1 : 0;

      if (defensiveIds.has(review.id)) {
        current.defensiveCount += 1;
        current.defensivePnl += exit.pnlPct;
        current.defensiveImprovement += exit.pnlPct - (review.outcome?.closeReturnPct ?? 0);
      }

      byRule.set(exit.rule, current);
    }
  }

  const leaderboard = [...byRule.values()].map(rule => ({
    ...rule,
    avgPnlPct: parseFloat((rule.totalPnl / rule.count).toFixed(2)),
    winRate: parseFloat(((rule.wins / rule.count) * 100).toFixed(1)),
    avgBarsHeld: parseFloat((rule.totalBars / rule.count).toFixed(1)),
    captureRate: parseFloat(((rule.captureRateSum / rule.count) * 100).toFixed(1)),
    defensiveAvgPnl: rule.defensiveCount ? parseFloat((rule.defensivePnl / rule.defensiveCount).toFixed(2)) : null,
    defensiveImprovement: rule.defensiveCount ? parseFloat((rule.defensiveImprovement / rule.defensiveCount).toFixed(2)) : null,
  })).sort((a, b) => b.avgPnlPct - a.avgPnlPct || b.winRate - a.winRate);

  const defensiveLeaderboard = leaderboard
    .filter(rule => rule.defensiveCount > 0)
    .sort((a, b) => (b.defensiveImprovement ?? -Infinity) - (a.defensiveImprovement ?? -Infinity) || (b.defensiveAvgPnl ?? -Infinity) - (a.defensiveAvgPnl ?? -Infinity) || a.avgBarsHeld - b.avgBarsHeld);

  return {
    triggeredCount: triggered.length,
    bestOverallRule: leaderboard[0] || null,
    bestDefensiveRule: defensiveLeaderboard[0] || null,
    leaderboard,
    defensiveLeaderboard,
  };
}

export function reviewOteTriggers(raw, maxReviews = MAX_REVIEWS) {
  const { closes, highs, lows } = raw;
  if (!closes?.length || closes.length < 80) return { latest: null, reviews: [] };

  const getSnapshot = makeSnapshotGetter(raw);
  const reviews = [];
  let previousInOte = false;
  let previousDirection = null;
  let previousSwing = "";

  for (let index = 40; index < closes.length - 2; index++) {
    const ote = calcOTE(highs.slice(0, index + 1), lows.slice(0, index + 1), closes.slice(0, index + 1));
    const swingKey = `${ote.swingHighIndex ?? "x"}:${ote.swingLowIndex ?? "x"}:${ote.direction ?? "x"}`;
    const newZoneTouch = ote.inOTE && (!previousInOte || previousDirection !== ote.direction || previousSwing !== swingKey);

    previousInOte = !!ote.inOTE;
    previousDirection = ote.direction || null;
    previousSwing = swingKey;

    if (!newZoneTouch) continue;
    if (!ote.validStructureBreak) continue;

    const entryTrigger = getEntryTrigger(raw, index, ote, ote.direction, closes.length - 1, getSnapshot);
    if (!entryTrigger) {
      reviews.push({
        id: `watch_${ote.direction}_${index}`,
        direction: ote.direction,
        zoneIndex: index,
        zoneDate: raw.timestamps?.[index] || null,
        entryIndex: null,
        entryDate: null,
        entryPrice: null,
        stop: null,
        target: null,
        oteTop: ote.oteTop,
        oteBottom: ote.oteBottom,
        swingHigh: ote.swingHigh,
        swingLow: ote.swingLow,
        retracementPct: ote.retracementPct,
        hasFVG: ote.hasFVG,
        validStructureBreak: ote.validStructureBreak,
        triggerQuality: 0,
        triggerConfirmations: [],
        triggerConfirmationCount: 0,
        triggerCandle: null,
        outcome: null,
        bestRuleExit: null,
        defensiveRuleExit: null,
        exitRules: [],
        narrative: `Price retested the OTE zone after a valid ${ote.direction.toLowerCase()} impulse, but no directional entry trigger printed within ${ENTRY_CONFIRM_BARS} bars.`,
      });
      continue;
    }

    const review = buildReview(raw, index, ote, entryTrigger, getSnapshot);
    if (review) reviews.push(review);
  }

  const sorted = reviews.sort((a, b) => {
    const aIndex = a.entryIndex ?? a.zoneIndex;
    const bIndex = b.entryIndex ?? b.zoneIndex;
    return bIndex - aIndex;
  }).slice(0, maxReviews);
  const latest = sorted[0] || null;
  const latestTriggered = sorted.find(review => review.entryPrice != null) || null;
  const aggregate = summarizeExitPerformance(reviews);
  const zoneTouches = reviews.length;
  const triggeredEntries = reviews.filter(review => review.entryPrice != null).length;

  return {
    latest,
    latestTriggered,
    reviews: sorted,
    overview: {
      zoneTouches,
      triggeredEntries,
      noTriggerTouches: zoneTouches - triggeredEntries,
      triggerRate: zoneTouches ? parseFloat(((triggeredEntries / zoneTouches) * 100).toFixed(1)) : 0,
      targetRate: aggregate.triggeredCount
        ? parseFloat(((reviews.filter(review => review.outcome?.targetHit).length / aggregate.triggeredCount) * 100).toFixed(1))
        : 0,
      failureRate: aggregate.triggeredCount
        ? parseFloat(((reviews.filter(review => review.outcome?.stopHit).length / aggregate.triggeredCount) * 100).toFixed(1))
        : 0,
    },
    aggregate,
  };
}
