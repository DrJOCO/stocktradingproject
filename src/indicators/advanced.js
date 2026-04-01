// Advanced indicators: Supertrend, VWAP, Ichimoku, Fibonacci, Pivots, A/D

import { calcATR, calcEMA, calcSMA } from './core.js';

export function calcSupertrend(highs, lows, closes, period = 10, multiplier = 3) {
  if (closes.length < period + 1) return { bullish: true, value: closes[closes.length - 1] };

  const atr = calcATR(highs, lows, closes, period);
  const mid = (highs[highs.length - 1] + lows[lows.length - 1]) / 2;
  const upperBand = mid + multiplier * atr;
  const lowerBand = mid - multiplier * atr;

  // Walk through recent bars to determine trend direction
  let trend = 1; // 1 = bullish, -1 = bearish
  let prevUpper = upperBand, prevLower = lowerBand;

  const n = Math.min(closes.length, 50);
  for (let i = closes.length - n; i < closes.length; i++) {
    const m = (highs[i] + lows[i]) / 2;
    const ub = m + multiplier * atr;
    const lb = m - multiplier * atr;
    const curLower = lb > prevLower ? lb : prevLower;
    const curUpper = ub < prevUpper ? ub : prevUpper;

    if (closes[i] > prevUpper) trend = 1;
    else if (closes[i] < prevLower) trend = -1;

    prevUpper = curUpper;
    prevLower = curLower;
  }

  const bullish = trend === 1;
  return { bullish, value: bullish ? lowerBand : upperBand };
}

// VWAP — volume-weighted average price (intraday approximation from candles)
export function calcVWAP(highs, lows, closes, volumes) {
  if (closes.length < 2) return closes[closes.length - 1];
  const n = Math.min(closes.length, 50);
  let sumPV = 0, sumV = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    sumPV += tp * volumes[i];
    sumV += volumes[i];
  }
  return sumV === 0 ? closes[closes.length - 1] : sumPV / sumV;
}

export function calcKeltner(highs, lows, closes, emaPeriod = 20, atrPeriod = 10, multiplier = 1.5) {
  const price = closes[closes.length - 1] || 0;
  if (closes.length < Math.max(emaPeriod, atrPeriod) + 1) {
    return { upper: price, middle: price, lower: price };
  }

  const middle = calcEMA(closes, emaPeriod) ?? price;
  const atr = calcATR(highs, lows, closes, atrPeriod);

  return {
    upper: middle + atr * multiplier,
    middle,
    lower: middle - atr * multiplier,
  };
}

function calcBollinger(highs, lows, closes, period = 20, multiplier = 2) {
  if (closes.length < period) {
    const price = closes[closes.length - 1] || 0;
    return { upper: price, middle: price, lower: price };
  }

  const window = closes.slice(-period);
  const middle = calcSMA(closes, period) ?? closes[closes.length - 1];
  const variance = window.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
  const deviation = Math.sqrt(variance);

  return {
    upper: middle + deviation * multiplier,
    middle,
    lower: middle - deviation * multiplier,
  };
}

export function calcTTMSqueeze(highs, lows, closes, period = 20, atrPeriod = 10, multiplier = 1.5) {
  if (closes.length < period + 2) {
    return { squeezeOn: false, momentum: 0, firing: false };
  }

  const bollinger = calcBollinger(highs, lows, closes, period, 2);
  const keltner = calcKeltner(highs, lows, closes, period, atrPeriod, multiplier);
  const prevBollinger = calcBollinger(highs.slice(0, -1), lows.slice(0, -1), closes.slice(0, -1), period, 2);
  const prevKeltner = calcKeltner(highs.slice(0, -1), lows.slice(0, -1), closes.slice(0, -1), period, atrPeriod, multiplier);

  const squeezeOn = bollinger.upper <= keltner.upper && bollinger.lower >= keltner.lower;
  const prevSqueezeOn = prevBollinger.upper <= prevKeltner.upper && prevBollinger.lower >= prevKeltner.lower;
  const firing = prevSqueezeOn && !squeezeOn;

  const recentHigh = Math.max(...highs.slice(-period));
  const recentLow = Math.min(...lows.slice(-period));
  const mean = calcSMA(closes, period) ?? closes[closes.length - 1];
  const momentumBase = ((recentHigh + recentLow) / 2 + mean) / 2;
  const momentum = closes[closes.length - 1] - momentumBase;

  return {
    squeezeOn,
    momentum: parseFloat(momentum.toFixed(3)),
    firing,
  };
}

// Ichimoku (Tenkan-sen, Kijun-sen, cloud position)
export function calcIchimoku(highs, lows, closes) {
  const tenkanP = 9, kijunP = 26;
  if (closes.length < kijunP) {
    return { bullish: true, tenkan: closes[closes.length - 1], kijun: closes[closes.length - 1], aboveCloud: true };
  }

  const tenkan = (Math.max(...highs.slice(-tenkanP)) + Math.min(...lows.slice(-tenkanP))) / 2;
  const kijun = (Math.max(...highs.slice(-kijunP)) + Math.min(...lows.slice(-kijunP))) / 2;
  const price = closes[closes.length - 1];

  return {
    bullish: price > kijun && tenkan > kijun,
    tenkan,
    kijun,
    aboveCloud: price > Math.max(tenkan, kijun),
  };
}

// Accumulation/Distribution line
export function calcAD(highs, lows, closes, volumes) {
  if (closes.length < 2) return { rising: true, value: 0 };
  let ad = 0;
  const arr = [];
  for (let i = 0; i < closes.length; i++) {
    const clv = highs[i] === lows[i] ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / (highs[i] - lows[i]);
    ad += clv * volumes[i];
    arr.push(ad);
  }
  const recent = arr.slice(-5);
  return { rising: recent[recent.length - 1] > recent[0], value: ad };
}

export function calcCMF(highs, lows, closes, volumes, period = 20) {
  if (closes.length < period || volumes.length < period) return 0;

  let flowVolume = 0;
  let totalVolume = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const range = highs[i] - lows[i];
    const multiplier = range === 0 ? 0 : ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
    flowVolume += multiplier * volumes[i];
    totalVolume += volumes[i];
  }

  return totalVolume === 0 ? 0 : parseFloat((flowVolume / totalVolume).toFixed(3));
}

export function calcHeikinAshi(opens, highs, lows, closes) {
  if (closes.length === 0) {
    return {
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      trend: "neutral",
      consecutiveGreen: 0,
      consecutiveRed: 0,
      noLowerWick: false,
      noUpperWick: false,
    };
  }

  const series = [];
  for (let i = 0; i < closes.length; i++) {
    const haClose = (opens[i] + highs[i] + lows[i] + closes[i]) / 4;
    const prev = series[i - 1];
    const haOpen = prev ? (prev.open + prev.close) / 2 : (opens[i] + closes[i]) / 2;
    const haHigh = Math.max(highs[i], haOpen, haClose);
    const haLow = Math.min(lows[i], haOpen, haClose);
    series.push({ open: haOpen, high: haHigh, low: haLow, close: haClose });
  }

  const last = series[series.length - 1];
  let consecutiveGreen = 0;
  let consecutiveRed = 0;

  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].close > series[i].open) {
      if (consecutiveRed > 0) break;
      consecutiveGreen++;
    } else if (series[i].close < series[i].open) {
      if (consecutiveGreen > 0) break;
      consecutiveRed++;
    } else {
      break;
    }
  }

  const wickTolerance = 1e-6;
  return {
    open: parseFloat(last.open.toFixed(3)),
    high: parseFloat(last.high.toFixed(3)),
    low: parseFloat(last.low.toFixed(3)),
    close: parseFloat(last.close.toFixed(3)),
    trend: last.close > last.open ? "bullish" : last.close < last.open ? "bearish" : "neutral",
    consecutiveGreen,
    consecutiveRed,
    noLowerWick: Math.abs(last.low - Math.min(last.open, last.close)) <= wickTolerance,
    noUpperWick: Math.abs(last.high - Math.max(last.open, last.close)) <= wickTolerance,
  };
}

// Fibonacci retracement levels from recent swing high/low
export function calcFibLevels(highs, lows) {
  const n = Math.min(highs.length, 50);
  const recentH = highs.slice(-n);
  const recentL = lows.slice(-n);
  const high = Math.max(...recentH);
  const low = Math.min(...recentL);
  const range = high - low;

  return {
    high,
    low,
    fib236: high - range * 0.236,
    fib382: high - range * 0.382,
    fib500: high - range * 0.500,
    fib618: high - range * 0.618,
    fib786: high - range * 0.786,
  };
}

// Pivot points (standard)
export function calcPivot(highs, lows, closes) {
  const h = highs[highs.length - 1];
  const l = lows[lows.length - 1];
  const c = closes[closes.length - 1];
  const pivot = (h + l + c) / 3;
  return {
    pivot,
    r1: 2 * pivot - l,
    r2: pivot + (h - l),
    s1: 2 * pivot - h,
    s2: pivot - (h - l),
  };
}


// OTE (Optimal Trade Entry) — ICT concept
// Detects when price retraces into the 62-79% Fib zone of the last significant swing
export function calcOTE(highs, lows, closes) {
  if (closes.length < 20) return { inOTE: false };

  const price = closes[closes.length - 1];
  const n = Math.min(closes.length, 50);
  const recentH = highs.slice(-n);
  const recentL = lows.slice(-n);

  // Find the most recent significant swing high and swing low
  // A swing high: higher than 3 bars on each side
  // A swing low: lower than 3 bars on each side
  let swingHigh = null, swingHighIdx = null;
  let swingLow = null, swingLowIdx = null;

  for (let i = recentH.length - 4; i >= 3; i--) {
    if (!swingHigh && recentH[i] > recentH[i-1] && recentH[i] > recentH[i-2] && recentH[i] > recentH[i-3]
        && recentH[i] > recentH[i+1] && recentH[i] > recentH[i+2]) {
      swingHigh = recentH[i];
      swingHighIdx = i;
    }
    if (!swingLow && recentL[i] < recentL[i-1] && recentL[i] < recentL[i-2] && recentL[i] < recentL[i-3]
        && recentL[i] < recentL[i+1] && recentL[i] < recentL[i+2]) {
      swingLow = recentL[i];
      swingLowIdx = i;
    }
    if (swingHigh && swingLow) break;
  }

  if (!swingHigh || !swingLow) return { inOTE: false };

  const range = swingHigh - swingLow;
  if (range <= 0) return { inOTE: false };

  // Determine trend direction: if swing low came before swing high, trend is up (and vice versa)
  const bullishSwing = swingLowIdx < swingHighIdx; // low formed first, then high = uptrend

  // OTE zone: 62-79% retracement of the swing
  let oteTop, oteBottom, direction;

  if (bullishSwing) {
    // Uptrend: OTE is a pullback DOWN into 62-79% retracement from the high
    oteTop = swingHigh - range * 0.618;
    oteBottom = swingHigh - range * 0.786;
    direction = "LONG";
  } else {
    // Downtrend: OTE is a bounce UP into 62-79% retracement from the low
    oteBottom = swingLow + range * 0.618;
    oteTop = swingLow + range * 0.786;
    direction = "SHORT";
  }

  const inOTE = price >= oteBottom && price <= oteTop;

  // How close to OTE zone (for "approaching" warning)
  const distToZone = bullishSwing
    ? (price - oteTop) / range  // positive = above zone, negative = below (already passed)
    : (oteBottom - price) / range;
  const approaching = distToZone > 0 && distToZone < 0.1; // within 10% of entering zone

  // Fair Value Gap detection (simplified): gap between bar[i] high and bar[i+2] low
  let hasFVG = false;
  const fvgBars = closes.slice(-10);
  const fvgH = highs.slice(-10);
  const fvgL = lows.slice(-10);
  for (let i = 0; i < fvgBars.length - 2; i++) {
    if (bullishSwing && fvgL[i + 2] > fvgH[i]) {
      // Bullish FVG: gap up
      if (price <= fvgL[i + 2] && price >= fvgH[i]) hasFVG = true;
    } else if (!bullishSwing && fvgH[i + 2] < fvgL[i]) {
      // Bearish FVG: gap down
      if (price >= fvgH[i + 2] && price <= fvgL[i]) hasFVG = true;
    }
  }

  return {
    inOTE,
    approaching,
    direction,
    oteTop: parseFloat(oteTop.toFixed(2)),
    oteBottom: parseFloat(oteBottom.toFixed(2)),
    swingHigh: parseFloat(swingHigh.toFixed(2)),
    swingLow: parseFloat(swingLow.toFixed(2)),
    hasFVG,
    retracementPct: bullishSwing
      ? parseFloat(((swingHigh - price) / range * 100).toFixed(1))
      : parseFloat(((price - swingLow) / range * 100).toFixed(1)),
  };
}
