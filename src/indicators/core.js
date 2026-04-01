// Core technical indicators with proper math

export function calcSMA(closes, period) {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

// RSI with Wilder's smoothing (the standard method)
export function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;

  // First average
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Wilder's smoothing for remaining values
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (delta > 0 ? delta : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (delta < 0 ? Math.abs(delta) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(1));
}

// Stochastic RSI with proper K and D smoothing
export function calcStochRSI(closes, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3) {
  if (closes.length < rsiPeriod + stochPeriod + kSmooth) return { k: 50, d: 50 };

  // Build RSI series
  const rsiSeries = [];
  for (let i = rsiPeriod + 1; i <= closes.length; i++) {
    rsiSeries.push(calcRSI(closes.slice(0, i), rsiPeriod));
  }

  if (rsiSeries.length < stochPeriod) return { k: 50, d: 50 };

  // Stochastic of RSI
  const stochK = [];
  for (let i = stochPeriod - 1; i < rsiSeries.length; i++) {
    const window = rsiSeries.slice(i - stochPeriod + 1, i + 1);
    const lo = Math.min(...window);
    const hi = Math.max(...window);
    stochK.push(hi === lo ? 50 : ((rsiSeries[i] - lo) / (hi - lo)) * 100);
  }

  // Smooth K with SMA
  const smoothedK = [];
  for (let i = kSmooth - 1; i < stochK.length; i++) {
    smoothedK.push(stochK.slice(i - kSmooth + 1, i + 1).reduce((a, b) => a + b, 0) / kSmooth);
  }

  // D is SMA of smoothed K
  const k = smoothedK[smoothedK.length - 1] || 50;
  const dWindow = smoothedK.slice(-dSmooth);
  const d = dWindow.length >= dSmooth ? dWindow.reduce((a, b) => a + b, 0) / dSmooth : k;

  return { k: parseFloat(k.toFixed(1)), d: parseFloat(d.toFixed(1)) };
}

export function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return { macdLine: 0, signalLine: 0, hist: 0, bullish: true };

  // Build MACD line series
  const macdSeries = [];
  for (let i = slow; i <= closes.length; i++) {
    const slice = closes.slice(0, i);
    const eFast = calcEMA(slice, fast);
    const eSlow = calcEMA(slice, slow);
    if (eFast !== null && eSlow !== null) macdSeries.push(eFast - eSlow);
  }

  const signalLine = calcEMA(macdSeries, signal) || 0;
  const macdLine = macdSeries[macdSeries.length - 1] || 0;
  return { macdLine, signalLine, hist: macdLine - signalLine, bullish: macdLine > signalLine };
}

function calcDirectionalMovement(highs, lows, closes, period = 14) {
  if (closes.length < period * 2) {
    return {
      adx: 15,
      plusDI: 0,
      minusDI: 0,
      prevPlusDI: 0,
      prevMinusDI: 0,
    };
  }

  const tr = [];
  const plusDM = [];
  const minusDM = [];

  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));

    const up = highs[i] - highs[i - 1];
    const down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }

  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let pDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let mDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  const dxSeries = [];
  const diSeries = [];

  for (let i = period; i < tr.length; i++) {
    if (i > period) {
      atr = atr - atr / period + tr[i];
      pDM = pDM - pDM / period + plusDM[i];
      mDM = mDM - mDM / period + minusDM[i];
    }

    const plusDI = atr > 0 ? (pDM / atr) * 100 : 0;
    const minusDI = atr > 0 ? (mDM / atr) * 100 : 0;
    diSeries.push({ plusDI, minusDI });

    const sum = plusDI + minusDI;
    if (sum > 0) dxSeries.push(Math.abs(plusDI - minusDI) / sum * 100);
  }

  if (dxSeries.length === 0 || diSeries.length === 0) {
    return {
      adx: 15,
      plusDI: 0,
      minusDI: 0,
      prevPlusDI: 0,
      prevMinusDI: 0,
    };
  }

  let adx = dxSeries.length < period
    ? dxSeries.reduce((a, b) => a + b, 0) / dxSeries.length
    : dxSeries.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < dxSeries.length; i++) {
    adx = (adx * (period - 1) + dxSeries[i]) / period;
  }

  const last = diSeries[diSeries.length - 1];
  const prev = diSeries[diSeries.length - 2] || last;

  return {
    adx: Math.min(adx, 99),
    plusDI: last.plusDI,
    minusDI: last.minusDI,
    prevPlusDI: prev.plusDI,
    prevMinusDI: prev.minusDI,
  };
}

// ADX with Wilder's smoothing
export function calcADX(highs, lows, closes, period = 14) {
  return Math.round(calcDirectionalMovement(highs, lows, closes, period).adx);
}

export function calcADXFull(highs, lows, closes, period = 14) {
  const { adx, plusDI, minusDI, prevPlusDI, prevMinusDI } = calcDirectionalMovement(highs, lows, closes, period);

  let crossover = null;
  if (plusDI > minusDI && prevPlusDI <= prevMinusDI) crossover = "bullish";
  else if (minusDI > plusDI && prevMinusDI <= prevPlusDI) crossover = "bearish";

  return {
    adx: Math.round(adx),
    plusDI: parseFloat(plusDI.toFixed(1)),
    minusDI: parseFloat(minusDI.toFixed(1)),
    crossover,
  };
}

function buildRSISeries(closes, period) {
  return closes.map((_, index) => {
    if (index < period) return null;
    return calcRSI(closes.slice(0, index + 1), period);
  });
}

function findPivotIndexes(values, mode, lookback, strength = 2) {
  const start = Math.max(strength, values.length - lookback);
  const end = values.length - strength;
  const pivots = [];

  for (let i = start; i < end; i++) {
    let isPivot = true;
    for (let offset = 1; offset <= strength; offset++) {
      if (mode === "low") {
        if (values[i] > values[i - offset] || values[i] >= values[i + offset]) {
          isPivot = false;
          break;
        }
      } else if (values[i] < values[i - offset] || values[i] <= values[i + offset]) {
        isPivot = false;
        break;
      }
    }
    if (isPivot) pivots.push(i);
  }

  return pivots;
}

export function calcRSIDivergence(closes, highs, lows, period = 14, lookback = 30) {
  if (closes.length < Math.max(period + 6, lookback)) {
    return { bullishDiv: false, bearishDiv: false, type: null };
  }

  const rsiSeries = buildRSISeries(closes, period);
  const lowPivots = findPivotIndexes(lows, "low", lookback);
  const highPivots = findPivotIndexes(highs, "high", lookback);

  let bullishDiv = false;
  let bearishDiv = false;

  if (lowPivots.length >= 2) {
    const prevIdx = lowPivots[lowPivots.length - 2];
    const lastIdx = lowPivots[lowPivots.length - 1];
    const prevRsi = rsiSeries[prevIdx];
    const lastRsi = rsiSeries[lastIdx];

    if (prevRsi !== null && lastRsi !== null) {
      bullishDiv = lows[lastIdx] < lows[prevIdx] * 0.995 && lastRsi > prevRsi + 2;
    }
  }

  if (highPivots.length >= 2) {
    const prevIdx = highPivots[highPivots.length - 2];
    const lastIdx = highPivots[highPivots.length - 1];
    const prevRsi = rsiSeries[prevIdx];
    const lastRsi = rsiSeries[lastIdx];

    if (prevRsi !== null && lastRsi !== null) {
      bearishDiv = highs[lastIdx] > highs[prevIdx] * 1.005 && lastRsi < prevRsi - 2;
    }
  }

  return {
    bullishDiv,
    bearishDiv,
    type: bullishDiv ? "bullish" : bearishDiv ? "bearish" : null,
  };
}

export function calcATR(highs, lows, closes, period = 14) {
  if (closes.length < 2) return 0;
  const tr = [];
  for (let i = 1; i < closes.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  if (tr.length < period) return tr.reduce((a, b) => a + b, 0) / tr.length;

  // Wilder's smoothing
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
  }
  return atr;
}

export function calcATRPct(highs, lows, closes, period = 14) {
  const atr = calcATR(highs, lows, closes, period);
  const price = closes[closes.length - 1];
  return price > 0 ? parseFloat((atr / price * 100).toFixed(2)) : 0;
}

export function calcBBPct(closes, period = 20) {
  if (closes.length < period) return 50;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  const upper = mean + 2 * std;
  const lower = mean - 2 * std;
  const price = closes[closes.length - 1];
  if (upper === lower) return 50;
  return Math.round(Math.min(100, Math.max(0, (price - lower) / (upper - lower) * 100)));
}

export function calcOBV(closes, volumes) {
  if (closes.length < 2) return { rising: true, value: 0 };
  let obv = 0;
  const arr = [0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
    arr.push(obv);
  }
  const recent = arr.slice(-5);
  return { rising: recent[recent.length - 1] > recent[0], value: obv };
}

export function calcVolMultiple(volumes) {
  if (volumes.length < 10) return 1;
  const avg = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  return avg > 0 ? parseFloat((volumes[volumes.length - 1] / avg).toFixed(1)) : 1;
}

export function calcWilliamsR(highs, lows, closes, period = 14) {
  if (closes.length < period) return -50;
  const hi = Math.max(...highs.slice(-period));
  const lo = Math.min(...lows.slice(-period));
  const price = closes[closes.length - 1];
  if (hi === lo) return -50;
  return parseFloat((((hi - price) / (hi - lo)) * -100).toFixed(1));
}
