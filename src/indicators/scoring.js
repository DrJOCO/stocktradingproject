// Signal scoring — combines all indicators into a directional signal

import {
  calcSMA, calcEMA, calcRSI, calcStochRSI, calcMACD, calcADXFull, calcRSIDivergence,
  calcATRPct, calcBBPct, calcOBV, calcVolMultiple, calcWilliamsR,
} from './core.js';
import {
  calcSupertrend, calcVWAP, calcIchimoku, calcAD, calcFibLevels, calcPivot, calcOTE,
  calcTTMSqueeze, calcCMF, calcHeikinAshi,
} from './advanced.js';
import {
  SCORE_LIMITS,
  STATIC_DIRECTIONAL_WEIGHTS,
  STATIC_SCORE_WEIGHTS,
  scoreWithDirectionalStates,
  signalFromScore,
} from './scoreConfig.js';

export const SIGNALS = {
  "STRONG LONG":  { color: "#22c55e", bar: "#22c55e", optType: "BULL CALL SPREAD", buyLabel: "BUY CALL", sellLabel: "SELL CALL" },
  "LONG BIAS":    { color: "#22c55e", bar: "#22c55e", optType: "BULL CALL SPREAD", buyLabel: "BUY CALL", sellLabel: "SELL CALL" },
  "NEUTRAL":      { color: "#eab308", bar: "#eab308", optType: "IRON CONDOR",      buyLabel: "BUY CALL", sellLabel: "SELL CALL" },
  "SHORT BIAS":   { color: "#a855f7", bar: "#ef4444", optType: "BEAR PUT SPREAD",  buyLabel: "BUY PUT",  sellLabel: "SELL PUT" },
  "STRONG SHORT": { color: "#ef4444", bar: "#ef4444", optType: "BEAR PUT SPREAD",  buyLabel: "BUY PUT",  sellLabel: "SELL PUT" },
};

function calcDirectionalState(value) {
  if (!value) return 0;
  return Math.max(-1, Math.min(1, value));
}

function computeConfidence(signal, directionalStates, { adx, volMult }) {
  if (signal === "NEUTRAL") {
    const activeBias = Object.values(directionalStates).reduce((sum, value) => sum + Math.abs(value), 0);
    return Math.max(42, Math.min(60, Math.round(54 - activeBias * 2)));
  }

  const direction = signal.includes("LONG") ? 1 : -1;
  let aligned = 0;
  let total = 0;

  for (const value of Object.values(directionalStates)) {
    if (!value) continue;
    const magnitude = Math.abs(value);
    total += magnitude;
    if (value * direction > 0) aligned += magnitude;
  }

  let confidence = 40 + ((aligned / (total || 1)) * 48);
  if (adx > 25) confidence += 4;
  if (volMult > 1.5) confidence += 3;
  if (volMult < 0.5) confidence -= 3;
  return Math.max(35, Math.min(94, Math.round(confidence)));
}

export function buildSignalSnapshot(raw) {
  const { closes: c, highs: h, lows: l, opens: o = raw.closes, volumes: v, livePrice } = raw;
  const price = livePrice ?? c[c.length - 1];

  const ema21 = calcEMA(c, 21);
  const ema50 = calcEMA(c, 50);
  const sma200 = calcSMA(c, 200);
  const fullBullStack = ema21 && ema50 && sma200 && price > ema21 && ema21 > ema50 && ema50 > sma200;
  const fullBearStack = ema21 && ema50 && sma200 && price < ema21 && ema21 < ema50 && ema50 < sma200;

  const rsi = calcRSI(c, 14);
  const stochRsi = calcStochRSI(c, 14, 14);
  const macd = calcMACD(c);
  const adxFull = calcADXFull(h, l, c, 14);
  const adx = adxFull.adx;
  const atrPct = calcATRPct(h, l, c, 14);
  const bbPct = calcBBPct(c, 20);
  const obv = calcOBV(c, v);
  const volMult = calcVolMultiple(v);
  const ad = calcAD(h, l, c, v);
  const cmf = calcCMF(h, l, c, v, 20);
  const supertrend = calcSupertrend(h, l, c, 10, 3);
  const vwap = calcVWAP(h, l, c, v);
  const willR = calcWilliamsR(h, l, c, 14);
  const ichimoku = calcIchimoku(h, l, c);
  const fib = calcFibLevels(h, l);
  const pivot = calcPivot(h, l, c);
  const ote = calcOTE(h, l, c);
  const ttmSqueeze = calcTTMSqueeze(h, l, c);
  const rsiDiv = calcRSIDivergence(c, h, l, 14, 30);
  const heikinAshi = calcHeikinAshi(o, h, l, c);
  const aboveVWAP = price > vwap;

  const directionalStates = {
    maStack: calcDirectionalState(fullBullStack ? 1 : fullBearStack ? -1 : 0),
    ema21Bias: calcDirectionalState(
      fullBullStack || fullBearStack || !ema21
        ? 0
        : price > ema21
        ? 1
        : price < ema21
        ? -1
        : 0
    ),
    supertrend: calcDirectionalState(supertrend.bullish ? 1 : -1),
    macd: calcDirectionalState(macd.bullish ? 1 : -1),
    aboveVWAP: calcDirectionalState(aboveVWAP ? 1 : -1),
    ichimoku: calcDirectionalState(ichimoku.bullish ? 1 : -1),
    rsiBias: calcDirectionalState(rsi > 50 && rsi < 70 ? 1 : rsi >= 70 ? -0.4 : rsi < 40 ? -1 : 0),
    stochRsiBias: calcDirectionalState(stochRsi.k > 50 && stochRsi.k < 80 ? 1 : stochRsi.k >= 80 ? -0.5 : stochRsi.k < 20 ? -1 : 0),
    volumeFlow: calcDirectionalState(obv.rising && ad.rising ? 1 : !obv.rising && !ad.rising ? -1 : 0),
    williamsRBias: calcDirectionalState(willR > -20 && !fullBullStack ? -1 : willR < -80 && !fullBearStack ? 1 : 0),
    dmiBias: calcDirectionalState(
      adxFull.adx > 20
        ? adxFull.plusDI > adxFull.minusDI
          ? 1
          : adxFull.minusDI > adxFull.plusDI
          ? -1
          : 0
        : 0
    ),
    rsiDivergence: calcDirectionalState(rsiDiv.bullishDiv ? 1 : rsiDiv.bearishDiv ? -1 : 0),
    squeezeBias: calcDirectionalState(ttmSqueeze.firing ? (ttmSqueeze.momentum > 0 ? 1 : ttmSqueeze.momentum < 0 ? -1 : 0) : 0),
    cmfBias: calcDirectionalState(cmf > 0.1 ? 1 : cmf < -0.1 ? -1 : 0),
    heikinAshi: calcDirectionalState(
      heikinAshi.trend === "bullish" && heikinAshi.consecutiveGreen >= 3
        ? 1
        : heikinAshi.trend === "bearish" && heikinAshi.consecutiveRed >= 3
        ? -1
        : 0
    ),
  };

  let fixedScore = SCORE_LIMITS.base;
  const weights = STATIC_SCORE_WEIGHTS;
  if (adx > 25) fixedScore += weights.adx.strongTrend;
  if (volMult > 1.5) fixedScore += weights.volumeParticipation.elevated;
  else if (volMult < 0.5) fixedScore += weights.volumeParticipation.thin;

  const score = scoreWithDirectionalStates(fixedScore, directionalStates, STATIC_DIRECTIONAL_WEIGHTS);
  const signal = signalFromScore(score);
  const confidence = computeConfidence(signal, directionalStates, { adx, volMult });

  return {
    price,
    ema21,
    ema50,
    sma200,
    fullBullStack,
    fullBearStack,
    rsi,
    stochRsi,
    macd,
    adx,
    adxFull,
    atrPct,
    bbPct,
    obv,
    volMult,
    ad,
    cmf,
    supertrend,
    vwap,
    willR,
    ichimoku,
    fib,
    pivot,
    ote,
    ttmSqueeze,
    rsiDiv,
    heikinAshi,
    aboveVWAP,
    directionalStates,
    fixedScore,
    score,
    signal,
    confidence,
  };
}

function buildCardFromSnapshot(ticker, timeframe, snapshot, meta = {}) {
  const { closes = [], highs = [], lows = [], ...cardMeta } = meta;
  const {
    price, signal, confidence, score, adx, atrPct, volMult, rsi, stochRsi, macd, bbPct,
    vwap, aboveVWAP, supertrend, willR, ichimoku, fib, pivot, ote, fullBullStack,
    fullBearStack, obv, ad, adxFull, rsiDiv, ttmSqueeze, cmf, heikinAshi, directionalStates,
  } = snapshot;

  const isLong = signal.includes("LONG");
  const isShort = signal.includes("SHORT");

  const atrAbs = price * (atrPct / 100);
  const entry = parseFloat(price.toFixed(3));
  const stop = parseFloat((isShort ? price + atrAbs * 1.8 : price - atrAbs * 1.8).toFixed(3));
  const target = parseFloat((isShort ? price - atrAbs * 3.6 : price + atrAbs * 3.6).toFixed(3));
  const stopPct = Math.abs((stop - entry) / entry * 100).toFixed(1);
  const tgtPct = Math.abs((target - entry) / entry * 100).toFixed(1);

  const step = price > 500 ? 5 : price > 100 ? 1 : 0.5;
  const rnd = (n, s) => Math.round(n / s) * s;
  const buyStrike = rnd(entry, step);
  const sellStrike = rnd(entry + (isShort ? -atrAbs * 2 : atrAbs * 2), step);
  const dte = adx > 30 ? "21-28" : "7-14";

  const indicators = buildIndicatorList({
    fullBullStack,
    fullBearStack,
    score,
    supertrend,
    aboveVWAP,
    ichimoku,
    macd,
    rsi,
    stochRsi,
    willR,
    obv,
    ad,
    volMult,
    adxFull,
    rsiDiv,
    ttmSqueeze,
    cmf,
    heikinAshi,
  });

  const earlyWarnings = buildEarlyWarnings(
    price,
    volMult,
    atrPct,
    fib,
    pivot,
    ote,
    rsiDiv,
    ttmSqueeze,
    cmf
  );

  const patterns = buildPatterns(highs, lows, closes, price, atrPct, isLong, isShort);
  const analysis = buildLocalAnalysis({
    signal,
    confidence,
    rsi,
    macd,
    supertrend,
    aboveVWAP,
    ichimoku,
    volMult,
    adx,
    fullBullStack,
    fullBearStack,
    atrPct,
    ote,
    rsiDiv,
    ttmSqueeze,
    cmf,
    heikinAshi,
  });

  return {
    ticker: ticker.toUpperCase(),
    timeframe,
    signal,
    confidence,
    score,
    adx,
    vol: volMult,
    entry,
    stop,
    target,
    stopPct,
    tgtPct,
    rsi,
    stochRsi,
    macdDir: macd.bullish ? "Bull" : "Bear",
    atrPct,
    bbPct,
    vwap: parseFloat(vwap.toFixed(3)),
    aboveVWAP,
    supertrend: supertrend.bullish,
    supertrendVal: parseFloat(supertrend.value.toFixed(3)),
    willR,
    ichimoku: ichimoku.bullish,
    fib,
    pivot,
    ote,
    adxFull,
    rsiDiv,
    ttmSqueeze,
    cmf,
    heikinAshi,
    directionalStates,
    indicators,
    earlyWarnings,
    patterns,
    analysis,
    opts: { show: true, dte, buyStrike, sellStrike },
    ...cardMeta,
  };
}

export function buildSignalCard(ticker, timeframe, raw) {
  const snapshot = buildSignalSnapshot(raw);
  return buildCardFromSnapshot(ticker, timeframe, snapshot, {
    closes: raw.closes,
    highs: raw.highs,
    lows: raw.lows,
  });
}

function buildIndicatorList({
  fullBullStack, fullBearStack, score, supertrend, aboveVWAP, ichimoku, macd, rsi,
  stochRsi, willR, obv, ad, volMult, adxFull, rsiDiv, ttmSqueeze, cmf, heikinAshi,
}) {
  const list = [];

  if (fullBullStack) list.push({ label: "Full bull stack: price > EMA21 > EMA50 > SMA200", type: "CONFIRM", status: "pass" });
  else if (fullBearStack) list.push({ label: "Bear stack: price < EMA21 < EMA50", type: "CONFIRM", status: "fail" });
  else list.push({ label: "Mixed MA stack — no clear alignment", type: "CONFIRM", status: "warn" });

  list.push({ label: `Trend score ${score >= 60 ? "supportive" : score >= 45 ? "mixed" : "weak"}: ${score}/100`, type: "CONFIRM", status: score >= 60 ? "pass" : score >= 45 ? "warn" : "fail" });
  list.push({ label: `Supertrend ${supertrend.bullish ? "bullish — price above support" : "bearish — price below resistance"}`, type: "CONFIRM", status: supertrend.bullish ? "pass" : "fail" });
  list.push({ label: `Rolling VWAP ${aboveVWAP ? "above — buyers in control" : "below — sellers in control"}`, type: "CONFIRM", status: aboveVWAP ? "pass" : "fail" });
  list.push({ label: `Ichimoku ${ichimoku.aboveCloud ? "above cloud — bullish" : "below cloud — bearish"}`, type: "LEADING", status: ichimoku.aboveCloud ? "pass" : "fail" });

  if (macd.bullish) list.push({ label: `MACD bullish + histogram ${macd.hist >= 0 ? "positive" : "recovering"}`, type: "CONFIRM", status: "pass" });
  else list.push({ label: `MACD bearish + histogram ${macd.hist <= 0 ? "negative" : "rolling over"}`, type: "LEADING", status: "fail" });

  if (rsi >= 70) list.push({ label: `RSI overbought ${rsi} — avoid chasing`, type: "LEADING", status: "warn" });
  else if (rsi <= 30) list.push({ label: `RSI oversold ${rsi} — potential reversal`, type: "LEADING", status: "warn" });
  else list.push({ label: `RSI ${rsi} — ${rsi > 50 ? "bullish" : "bearish"} zone`, type: "CONFIRM", status: rsi > 50 ? "pass" : "fail" });

  list.push({ label: `Stoch RSI K:${stochRsi.k} D:${stochRsi.d} — ${stochRsi.k > 80 ? "overbought" : stochRsi.k < 20 ? "oversold" : "neutral zone"}`, type: "LEADING", status: stochRsi.k > 80 || stochRsi.k < 20 ? "warn" : "pass" });
  list.push({ label: `Williams %R ${willR} — ${willR > -20 ? "overbought" : willR < -80 ? "oversold" : "neutral"}`, type: "LEADING", status: (willR > -20 || willR < -80) ? "warn" : "pass" });

  // OTE check is added via earlyWarnings, not here (it's a setup, not a confirm/leading indicator)

  if (obv.rising && ad.rising) list.push({ label: cmf > 0.1 ? "OBV rising + CMF positive — institutional accumulation" : "OBV + A/D rising — accumulation", type: "CONFIRM", status: "pass" });
  else if (!obv.rising && !ad.rising) list.push({ label: cmf < -0.1 ? "OBV falling + CMF negative — distribution" : "OBV + A/D falling — distribution", type: "CONFIRM", status: "fail" });
  else list.push({ label: "Mixed volume signals", type: "CONFIRM", status: "warn" });

  if (adxFull.adx > 20) {
    const bullishDmi = adxFull.plusDI > adxFull.minusDI;
    list.push({
      label: `DMI ${bullishDmi ? "bullish" : "bearish"}: +DI ${adxFull.plusDI} / -DI ${adxFull.minusDI} with ADX ${adxFull.adx}`,
      type: "CONFIRM",
      status: bullishDmi ? "pass" : "fail",
    });
  } else {
    list.push({ label: `ADX ${adxFull.adx} — trend strength not yet confirmed`, type: "LEADING", status: "warn" });
  }

  if (rsiDiv.bullishDiv) list.push({ label: "Bullish RSI divergence — momentum improving into weakness", type: "LEADING", status: "pass" });
  else if (rsiDiv.bearishDiv) list.push({ label: "Bearish RSI divergence — upside momentum fading", type: "LEADING", status: "fail" });

  if (ttmSqueeze.firing) {
    list.push({
      label: `TTM Squeeze fired ${ttmSqueeze.momentum > 0 ? "up" : "down"} with momentum ${ttmSqueeze.momentum}`,
      type: "LEADING",
      status: ttmSqueeze.momentum > 0 ? "pass" : "fail",
    });
  } else if (ttmSqueeze.squeezeOn) {
    list.push({ label: "TTM Squeeze active — volatility compression in progress", type: "LEADING", status: "warn" });
  }

  if (cmf > 0.1) list.push({ label: `CMF ${cmf} — healthy accumulation pressure`, type: "CONFIRM", status: "pass" });
  else if (cmf < -0.1) list.push({ label: `CMF ${cmf} — distribution pressure building`, type: "CONFIRM", status: "fail" });

  if (heikinAshi.trend === "bullish" && heikinAshi.consecutiveGreen >= 3) {
    list.push({ label: `Heikin Ashi ${heikinAshi.consecutiveGreen} green candles — trend persistence`, type: "CONFIRM", status: "pass" });
  } else if (heikinAshi.trend === "bearish" && heikinAshi.consecutiveRed >= 3) {
    list.push({ label: `Heikin Ashi ${heikinAshi.consecutiveRed} red candles — downside trend persistence`, type: "CONFIRM", status: "fail" });
  }

  if (volMult < 0.5) list.push({ label: `Volume thin (${volMult}x avg) — low conviction`, type: "CONFIRM", status: "warn" });
  else if (volMult > 1.5) list.push({ label: `Volume ${volMult}x avg — strong participation`, type: "CONFIRM", status: "pass" });

  return list;
}

function buildEarlyWarnings(price, volMult, atrPct, fib, pivot, ote, rsiDiv, ttmSqueeze, cmf) {
  const warnings = [];

  if (volMult < 0.5) {
    warnings.push({ icon: "▲", color: "#22c55e", title: "VOLUME DRY-UP", type: "LEADING",
      desc: `Volume ${Math.round((1 - volMult) * 100)}% below 20-bar avg. Often precedes directional move.` });
  }

  if (atrPct < 1.0) {
    warnings.push({ icon: "▣", color: "#a855f7", title: "VOLATILITY SQUEEZE", type: "LEADING",
      desc: `ATR at ${atrPct}% — compressed volatility. Watch for explosive move.` });
  }

  if (Math.abs(price - fib.fib618) / price < 0.01) {
    warnings.push({ icon: "◈", color: "#06b6d4", title: "AT 61.8% FIB LEVEL", type: "LEADING",
      desc: `Price near 61.8% retracement ($${fib.fib618.toFixed(2)}) — key decision point.` });
  }

  if (Math.abs(price - pivot.pivot) / price < 0.005) {
    warnings.push({ icon: "◎", color: "#f97316", title: "AT PIVOT POINT", type: "LEADING",
      desc: `Price at pivot ($${pivot.pivot.toFixed(2)}). Breakout direction significant.` });
  }

  if (ttmSqueeze.squeezeOn) {
    warnings.push({
      icon: "◍", color: "#06b6d4", title: "TTM SQUEEZE COILED", type: "LEADING",
      desc: "Bollinger Bands are inside the Keltner Channel. Compression is building and usually resolves with an expansion move.",
    });
  } else if (ttmSqueeze.firing) {
    warnings.push({
      icon: "✦", color: ttmSqueeze.momentum > 0 ? "#22c55e" : "#ef4444", title: "TTM SQUEEZE FIRED", type: "LEADING",
      desc: `Compression just released with ${ttmSqueeze.momentum > 0 ? "bullish" : "bearish"} momentum (${ttmSqueeze.momentum}). Follow-through often comes in the same direction.`,
    });
  }

  if (rsiDiv.bullishDiv) {
    warnings.push({
      icon: "↗", color: "#22c55e", title: "BULLISH RSI DIVERGENCE", type: "LEADING",
      desc: "Price made a lower low while RSI improved. That often shows seller exhaustion before a reversal.",
    });
  } else if (rsiDiv.bearishDiv) {
    warnings.push({
      icon: "↘", color: "#ef4444", title: "BEARISH RSI DIVERGENCE", type: "LEADING",
      desc: "Price made a higher high while RSI weakened. Momentum is fading and reversal risk is higher.",
    });
  }

  if (cmf > 0.15) {
    warnings.push({
      icon: "⬈", color: "#22c55e", title: "CMF ACCUMULATION", type: "LEADING",
      desc: `CMF at ${cmf} suggests buyers are still supporting the move under the surface.`,
    });
  } else if (cmf < -0.15) {
    warnings.push({
      icon: "⬊", color: "#ef4444", title: "CMF DISTRIBUTION", type: "LEADING",
      desc: `CMF at ${cmf} suggests supply is outweighing demand and rallies may fade.`,
    });
  }

  // OTE (Optimal Trade Entry)
  if (ote?.validStructureBreak && ote.inOTE) {
    const dirLabel = ote.direction === "LONG" ? "bullish" : "bearish";
    warnings.push({
      icon: "◆", color: "#22c55e", title: `OTE — OPTIMAL ${ote.direction} ENTRY`, type: "LEADING",
      desc: `Price is in the 62-79% retracement zone ($${ote.oteBottom}-$${ote.oteTop}) of the ${dirLabel} swing ($${ote.swingLow} to $${ote.swingHigh}). Retracement: ${ote.retracementPct}%.${ote.hasFVG ? " Fair Value Gap present — higher probability entry." : ""} This is a high-probability pullback entry point.`,
    });
  } else if (ote?.validStructureBreak && ote.approaching) {
    warnings.push({
      icon: "◇", color: "#eab308", title: "APPROACHING OTE ZONE", type: "LEADING",
      desc: `Price is nearing the OTE zone ($${ote.oteBottom}-$${ote.oteTop}). ${ote.direction} setup forming. Watch for entry on the next pullback into the zone.`,
    });
  }

  return warnings;
}

function buildPatterns(h, l, c, price, atrPct, isLong, isShort) {
  const patterns = [];
  const rLows = l.slice(-30), rHighs = h.slice(-30);
  if (rLows.length < 30) return patterns;

  const l1 = Math.min(...rLows.slice(0, 15));
  const l2 = Math.min(...rLows.slice(15));
  if (Math.abs(l1 - l2) / l1 < 0.03 && price > Math.max(l1, l2) * 1.02 && isLong) {
    patterns.push({
      dir: "▲", name: "Double Bottom", patType: "TYPE 1", patColor: "#eab308", borderColor: "#eab308",
      subtitle: "Breakout entry — price crossing neckline",
      detail: `Bottoms: $${l1.toFixed(2)} & $${l2.toFixed(2)}`,
      reliability: 69, tgtPct: parseFloat((atrPct * 2).toFixed(1)),
      patStop: parseFloat((Math.min(l1, l2) * 0.99).toFixed(2)), stopNote: "Below lowest bottom",
    });
  }

  const h1 = Math.max(...rHighs.slice(0, 15));
  const h2 = Math.max(...rHighs.slice(15));
  if (Math.abs(h1 - h2) / h1 < 0.03 && price < Math.min(h1, h2) * 0.98 && isShort) {
    patterns.push({
      dir: "▼", name: "Double Top", patType: "TYPE 1", patColor: "#f97316", borderColor: "#f97316",
      subtitle: "Breakdown — price crossing neckline",
      detail: `Tops: $${h1.toFixed(2)} & $${h2.toFixed(2)}`,
      reliability: 65, tgtPct: parseFloat((-atrPct * 2).toFixed(1)),
      patStop: parseFloat((Math.max(h1, h2) * 1.01).toFixed(2)), stopNote: "Above highest top",
    });
  }

  return patterns;
}

/**
 * Re-score a signal card using adaptive weights learned from backtest.
 * This replaces the static weights with what actually works on this ticker.
 */
export function rescoreWithAdaptiveWeights(card, raw, adaptiveWeights) {
  if (!adaptiveWeights || !raw) return card;

  const snapshot = buildSignalSnapshot(raw);
  const score = scoreWithDirectionalStates(snapshot.fixedScore, snapshot.directionalStates, adaptiveWeights);
  const signal = signalFromScore(score);
  const confidence = computeConfidence(signal, snapshot.directionalStates, {
    adx: snapshot.adx,
    volMult: snapshot.volMult,
  });

  const rescoredSnapshot = { ...snapshot, score, signal, confidence };
  return buildCardFromSnapshot(card.ticker, card.timeframe, rescoredSnapshot, {
    closes: raw.closes,
    highs: raw.highs,
    lows: raw.lows,
    adaptiveScored: true,
    originalScore: card.score,
    originalSignal: card.signal,
  });
}

// Local analysis — generates summary + plain-English commentary
function buildLocalAnalysis({
  signal, confidence, rsi, macd, supertrend, aboveVWAP, ichimoku, volMult, adx,
  fullBullStack, fullBearStack, atrPct, ote, rsiDiv, ttmSqueeze, cmf, heikinAshi,
}) {
  const bullish = signal.includes("LONG");
  const bearish = signal.includes("SHORT");
  const neutral = signal === "NEUTRAL";

  const bullFactors = [macd.bullish, supertrend.bullish, aboveVWAP, ichimoku.bullish, rsi > 50, fullBullStack].filter(Boolean).length;
  const bearFactors = [!macd.bullish, !supertrend.bullish, !aboveVWAP, !ichimoku.bullish, rsi < 50, fullBearStack].filter(Boolean).length;
  const structureNotes = [];
  if (rsiDiv.bullishDiv) structureNotes.push("bullish RSI divergence is improving momentum");
  else if (rsiDiv.bearishDiv) structureNotes.push("bearish RSI divergence warns momentum is fading");
  if (ttmSqueeze.firing) structureNotes.push(`TTM Squeeze fired ${ttmSqueeze.momentum > 0 ? "higher" : "lower"}`);
  else if (ttmSqueeze.squeezeOn) structureNotes.push("TTM Squeeze is still compressed");
  if (cmf > 0.1) structureNotes.push("CMF confirms accumulation");
  else if (cmf < -0.1) structureNotes.push("CMF points to distribution");
  if (heikinAshi.trend === "bullish" && heikinAshi.consecutiveGreen >= 3) structureNotes.push("Heikin Ashi trend is persistently bullish");
  else if (heikinAshi.trend === "bearish" && heikinAshi.consecutiveRed >= 3) structureNotes.push("Heikin Ashi trend is persistently bearish");

  let summary;
  if (bullish) {
    summary = `${bullFactors} of 6 core trend indicators are bullish. ${fullBullStack ? "Price is above all major moving averages in a full bull stack." : "Moving averages show mixed alignment."} ${adx > 25 ? `ADX at ${adx} shows strong trend.` : "Trend strength is moderate."} ${volMult > 1.2 ? "Volume confirms the move." : "Volume is not yet confirming — watch for pickup."}${structureNotes.length ? ` ${structureNotes.join(". ")}.` : ""}`;
  } else if (bearish) {
    summary = `${bearFactors} of 6 core trend indicators are bearish. ${fullBearStack ? "Price is below key moving averages." : "MA alignment is mixed but leaning bearish."} ${adx > 25 ? `ADX at ${adx} shows strong downtrend.` : "Trend strength is moderate."} ${volMult > 1.2 ? "Selling volume confirms the move." : "Volume is light — could be a pullback, not reversal."}${structureNotes.length ? ` ${structureNotes.join(". ")}.` : ""}`;
  } else {
    summary = `Market is directionless with ${bullFactors} bull and ${bearFactors} bear signals. ${adx < 20 ? "ADX below 20 — no trend." : ""}${structureNotes.length ? ` ${structureNotes.join(". ")}.` : ""} Wait for a clear breakout before committing.`;
  }

  const keyStrength = fullBullStack ? "Full MA bull stack alignment" :
    rsiDiv.bullishDiv ? "Bullish RSI divergence" :
    ttmSqueeze.firing && ttmSqueeze.momentum > 0 ? "TTM squeeze fired upward" :
    cmf > 0.1 ? `Positive CMF (${cmf}) accumulation` :
    heikinAshi.trend === "bullish" && heikinAshi.consecutiveGreen >= 3 ? "Heikin Ashi bullish trend persistence" :
    fullBearStack ? "Full MA bear alignment" :
    supertrend.bullish && aboveVWAP ? "Supertrend + rolling VWAP bullish" :
    !supertrend.bullish && !aboveVWAP ? "Supertrend + rolling VWAP bearish" :
    adx > 30 ? `Strong trend (ADX ${adx})` : "No dominant factor";

  const keyRisk = rsiDiv.bearishDiv ? "Bearish RSI divergence — reversal risk" :
    ttmSqueeze.firing && ttmSqueeze.momentum < 0 ? "TTM squeeze fired lower — downside acceleration risk" :
    cmf < -0.1 ? `Negative CMF (${cmf}) — distribution risk` :
    heikinAshi.trend === "bearish" && heikinAshi.consecutiveRed >= 3 ? "Heikin Ashi downside trend persistence" :
    rsi > 70 ? "RSI overbought — pullback risk" :
    rsi < 30 ? "RSI oversold — capitulation risk" :
    volMult < 0.5 ? "Very low volume — no conviction" :
    adx < 20 ? "Weak trend — choppy conditions" :
    "Standard market risk";

  const conviction = confidence >= 70 ? "HIGH" : confidence >= 55 ? "MEDIUM" : "LOW";

  const counterTrendBull = [
    rsiDiv.bullishDiv ? "bullish RSI divergence" : null,
    ttmSqueeze.firing && ttmSqueeze.momentum > 0 ? "a squeeze firing higher" : null,
    cmf > 0.1 ? "positive CMF accumulation" : null,
    heikinAshi.trend === "bullish" && heikinAshi.consecutiveGreen >= 3 ? "bullish Heikin Ashi persistence" : null,
    ote?.validStructureBreak && ote.direction === "LONG" && (ote.inOTE || ote.approaching) ? "an OTE long pullback setup" : null,
  ].filter(Boolean);

  const counterTrendBear = [
    rsiDiv.bearishDiv ? "bearish RSI divergence" : null,
    ttmSqueeze.firing && ttmSqueeze.momentum < 0 ? "a squeeze firing lower" : null,
    cmf < -0.1 ? "negative CMF distribution" : null,
    heikinAshi.trend === "bearish" && heikinAshi.consecutiveRed >= 3 ? "bearish Heikin Ashi persistence" : null,
    ote?.validStructureBreak && ote.direction === "SHORT" && (ote.inOTE || ote.approaching) ? "an OTE short retracement setup" : null,
  ].filter(Boolean);

  let suggestion;
  if (bullish && confidence >= 65) suggestion = "Consider long entry with stop below support.";
  else if (bearish && confidence >= 65) suggestion = "Consider short or protective puts.";
  else if (neutral) suggestion = "Stay flat — wait for directional commitment.";
  else suggestion = "Signal is weak. Reduce size or wait for confirmation.";

  let heroLead;
  if (bullish) {
    heroLead = bullFactors >= 4 ? "Majority of indicators bullish." : "Bullish bias, but not unanimous.";
  } else if (bearish) {
    heroLead = bearFactors >= 4 ? "Majority of indicators bearish." : "Bearish bias, but not unanimous.";
  } else {
    heroLead = "Signals are mixed and direction is unclear.";
  }

  let heroSub;
  if (confidence >= 75) heroSub = bullish ? "Trend, momentum, and structure are broadly aligned." : bearish ? "Trend, momentum, and structure are aligned lower." : "Wait for expansion before taking size.";
  else if (confidence >= 55) heroSub = bullish ? "Lean long, but size smaller until confirmation broadens." : bearish ? "Lean short, but size smaller until confirmation broadens." : "Stay selective — this is still a range-bound tape.";
  else heroSub = bullish ? "Size smaller — confirmation is not unanimous yet." : bearish ? "Size smaller — confirmation is not unanimous yet." : "Best trade may be patience until a clean break appears.";

  let contextTitle = null;
  let contextBody = null;
  if (bearish && counterTrendBull.length) {
    contextTitle = "Signal Conflict";
    contextBody = `${signal} reflects the broader bearish tape across trend and structure. At the same time, ${counterTrendBull.join(", ")} point to a short-term bounce or pause. These are not contradictory — aggressive traders can play the bounce, but the cleaner trade is usually to let that bounce fade and then re-short with confirmation.`;
  } else if (bullish && counterTrendBear.length) {
    contextTitle = "Signal Conflict";
    contextBody = `${signal} reflects the broader bullish tape across trend and structure. At the same time, ${counterTrendBear.join(", ")} warn that upside momentum may stall first. These are not contradictory — a shallow pullback can happen inside a bullish trend, so it often makes sense to wait for the dip to stabilize before pressing longs.`;
  } else if (neutral && (counterTrendBull.length || counterTrendBear.length)) {
    contextTitle = "Trade Narrative";
    contextBody = `The market is balanced overall, but ${[...counterTrendBull, ...counterTrendBear].join(", ")} show a setup is forming beneath the surface. Let price resolve first, then trade in the direction of the actual breakout.`;
  }

  // --- Plain-English Commentary (like the screenshot) ---
  const commentary = buildCommentary({
    signal, confidence, rsi, volMult, adx, fullBullStack, atrPct, ote, rsiDiv, ttmSqueeze, cmf, heikinAshi,
  });

  // --- IV Proxy ---
  const ivEnvironment = atrPct > 3.5 ? "HIGH" : atrPct > 1.5 ? "NORMAL" : "LOW";
  const ivNote = ivEnvironment === "HIGH"
    ? "Elevated volatility — favor selling premium (credit spreads)."
    : ivEnvironment === "LOW"
    ? "Low volatility — favor buying premium (debit spreads)."
    : "Normal volatility environment.";

  return {
    summary,
    keyStrength,
    keyRisk,
    conviction,
    suggestion,
    commentary,
    ivEnvironment,
    ivNote,
    heroLead,
    heroSub,
    contextTitle,
    contextBody,
  };
}

function buildCommentary({ signal, confidence, rsi, volMult, adx, fullBullStack, atrPct, ote, rsiDiv, ttmSqueeze, cmf, heikinAshi }) {
  const parts = [];
  const conv = confidence >= 70 ? "High" : confidence >= 55 ? "Medium" : "Low";

  // Conviction + direction sentence
  if (signal === "STRONG LONG") {
    parts.push(`${conv} conviction bullish.`);
    if (fullBullStack) parts.push("Buy dips into support.");
    else parts.push("Look for pullback entries.");
    if (adx > 30) parts.push("Trend is strong — let it run.");
    else parts.push("Trail stop to protect gains.");
  } else if (signal === "LONG BIAS") {
    parts.push(`${conv} conviction lean bullish.`);
    parts.push(rsi > 60 ? "Wait for a pullback to add." : "Accumulate on weakness.");
    if (volMult < 0.8) parts.push("Volume is thin — size down.");
  } else if (signal === "NEUTRAL") {
    parts.push("No clear direction.");
    parts.push("Stay flat or reduce exposure.");
    if (adx < 20) parts.push("Choppy conditions — range-bound strategies preferred.");
    else parts.push("Wait for breakout confirmation.");
  } else if (signal === "SHORT BIAS") {
    parts.push(`${conv} conviction lean bearish.`);
    parts.push(rsi < 40 ? "Don't chase the short — wait for bounce." : "Short on bounces to resistance.");
    if (volMult > 1.5) parts.push("Heavy selling pressure confirms.");
  } else if (signal === "STRONG SHORT") {
    parts.push(`${conv} conviction bearish.`);
    parts.push("Short on bounces.");
    parts.push(atrPct > 2 ? "Trail stop tight." : "Wider stops okay — low volatility.");
  }

  // Volume context
  if (volMult < 0.5) parts.push("Volume dry — low conviction move.");
  else if (volMult > 2) parts.push("Heavy volume — institutional activity.");

  // Overbought/oversold warning
  if (rsi > 75) parts.push("RSI stretched — don't chase.");
  else if (rsi < 25) parts.push("RSI oversold — bounce likely but don't catch knives.");

  if (rsiDiv.bullishDiv) parts.push("Bullish RSI divergence is supporting the reversal case.");
  else if (rsiDiv.bearishDiv) parts.push("Bearish RSI divergence says momentum is fading.");

  if (ttmSqueeze.squeezeOn) parts.push("TTM Squeeze is coiled — expansion setup is building.");
  else if (ttmSqueeze.firing) parts.push(`TTM Squeeze fired ${ttmSqueeze.momentum > 0 ? "higher" : "lower"} — watch for follow-through.`);

  if (cmf > 0.1) parts.push("CMF shows accumulation.");
  else if (cmf < -0.1) parts.push("CMF shows distribution.");

  if (heikinAshi.trend === "bullish" && heikinAshi.consecutiveGreen >= 3) parts.push("Heikin Ashi candles show persistent bullish control.");
  else if (heikinAshi.trend === "bearish" && heikinAshi.consecutiveRed >= 3) parts.push("Heikin Ashi candles show persistent bearish control.");

  // OTE
  if (ote?.validStructureBreak && ote.inOTE) {
    parts.push(`OTE entry active — price in the ${ote.retracementPct}% retracement sweet spot.${ote.hasFVG ? " FVG confluence." : ""} High-probability pullback entry.`);
  } else if (ote?.validStructureBreak && ote.approaching) {
    parts.push("Approaching OTE zone — watch for entry on pullback.");
  }

  return parts.join(" ");
}
