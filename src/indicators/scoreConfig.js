export const SCORE_LIMITS = {
  base: 50,
  min: 10,
  max: 96,
};

export const SCORE_THRESHOLDS = {
  strongLong: 72,
  longBias: 58,
  neutral: 43,
  shortBias: 30,
};

export const STATIC_SCORE_WEIGHTS = {
  maAlignment: {
    fullBullStack: 12,
    fullBearStack: -12,
    aboveEma21: 4,
    belowEma21: -4,
  },
  supertrend: {
    bullish: 8,
    bearish: -8,
  },
  macd: {
    bullish: 7,
    bearish: -7,
  },
  vwap: {
    above: 5,
    below: -5,
  },
  ichimoku: {
    bullish: 5,
    bearish: -5,
  },
  rsi: {
    bullishRange: 5,
    overbought: -2,
    weak: -5,
  },
  stochRsi: {
    bullishRange: 4,
    overbought: -2,
    oversold: -4,
  },
  volumeFlow: {
    accumulation: 5,
    distribution: -5,
  },
  adx: {
    strongTrend: 4,
  },
  volumeParticipation: {
    elevated: 3,
    thin: -2,
  },
  williamsR: {
    overboughtWarning: -2,
    oversoldSupport: 2,
  },
  dmi: {
    bullish: 3,
    bearish: -3,
  },
  rsiDivergence: {
    bullish: 5,
    bearish: -5,
  },
  squeeze: {
    bullish: 4,
    bearish: -4,
  },
  cmf: {
    bullish: 3,
    bearish: -3,
  },
  heikinAshi: {
    bullish: 3,
    bearish: -3,
  },
};

export const STATIC_DIRECTIONAL_WEIGHTS = {
  maStack: 12,
  ema21Bias: 4,
  supertrend: 8,
  macd: 7,
  aboveVWAP: 5,
  ichimoku: 5,
  rsiBias: 5,
  stochRsiBias: 4,
  volumeFlow: 5,
  williamsRBias: 2,
  dmiBias: 3,
  rsiDivergence: 5,
  squeezeBias: 4,
  cmfBias: 3,
  heikinAshi: 3,
};

export const ADAPTIVE_DEFAULT_WEIGHTS = {
  maStack: 12,
  ema21Bias: 4,
  supertrend: 8,
  macd: 7,
  aboveVWAP: 5,
  ichimoku: 5,
  rsiBias: 5,
  stochRsiBias: 4,
  volumeFlow: 5,
  williamsRBias: 2,
  dmiBias: 3,
  rsiDivergence: 5,
  squeezeBias: 4,
  cmfBias: 3,
  heikinAshi: 3,
};

export const ADAPTIVE_INDICATOR_LABELS = {
  maStack: "MA Stack",
  ema21Bias: "EMA21 Bias",
  supertrend: "Supertrend",
  macd: "MACD",
  aboveVWAP: "VWAP",
  ichimoku: "Ichimoku",
  rsiBias: "RSI Bias",
  stochRsiBias: "Stoch RSI",
  volumeFlow: "OBV + A/D",
  williamsRBias: "Williams %R",
  dmiBias: "DMI / ADX",
  rsiDivergence: "RSI Div",
  squeezeBias: "TTM Squeeze",
  cmfBias: "CMF",
  heikinAshi: "Heikin Ashi",
};

export function clampScore(score) {
  return Math.max(SCORE_LIMITS.min, Math.min(SCORE_LIMITS.max, Math.round(score)));
}

export function scoreWithDirectionalStates(fixedScore, indicatorStates, weights = ADAPTIVE_DEFAULT_WEIGHTS) {
  const activeWeights = weights || ADAPTIVE_DEFAULT_WEIGHTS;
  let score = fixedScore;
  for (const [name, state] of Object.entries(indicatorStates)) {
    if (!state) continue;
    score += state * (activeWeights[name] ?? 0);
  }
  return clampScore(score);
}

export function signalFromScore(score) {
  if (score >= SCORE_THRESHOLDS.strongLong) return "STRONG LONG";
  if (score >= SCORE_THRESHOLDS.longBias) return "LONG BIAS";
  if (score >= SCORE_THRESHOLDS.neutral) return "NEUTRAL";
  if (score >= SCORE_THRESHOLDS.shortBias) return "SHORT BIAS";
  return "STRONG SHORT";
}
