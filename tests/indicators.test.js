import assert from "node:assert/strict";
import test from "node:test";

import { calcATRSeries, calcRSI, calcRSIDivergence, calcStochRSI } from "../src/indicators/core.js";
import { calcSupertrend } from "../src/indicators/advanced.js";
import { getOteReviewTimeframes, summarizeExitPerformance } from "../src/indicators/oteReview.js";

test("calcRSI returns neutral for insufficient data and strong momentum for persistent gains", () => {
  assert.equal(calcRSI([100, 101, 102], 14), 50);
  assert.equal(calcRSI([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 14), 100);
});

test("calcStochRSI stays bounded between 0 and 100 on oscillating data", () => {
  const closes = Array.from({ length: 48 }, (_, index) => 100 + Math.sin(index / 2) * 6 + (index % 3));
  const { k, d } = calcStochRSI(closes, 14, 14, 3, 3);

  assert.ok(Number.isFinite(k));
  assert.ok(Number.isFinite(d));
  assert.ok(k >= 0 && k <= 100);
  assert.ok(d >= 0 && d <= 100);
});

test("calcATRSeries expands when recent candle ranges widen", () => {
  const closes = Array.from({ length: 30 }, (_, index) => 100 + index * 0.4);
  const highs = closes.map((value, index) => value + (index < 18 ? 1 : 4));
  const lows = closes.map((value, index) => value - (index < 18 ? 1 : 4));
  const atrSeries = calcATRSeries(highs, lows, closes, 10);

  assert.ok(atrSeries[10] > 0);
  assert.ok(atrSeries.at(-1) > atrSeries[10]);
});

test("calcSupertrend tracks both persistent uptrends and hard bearish reversals", () => {
  const uptrend = Array.from({ length: 25 }, (_, index) => 100 + index);
  const uptrendHighs = uptrend.map(value => value + 1);
  const uptrendLows = uptrend.map(value => value - 1);
  const uptrendResult = calcSupertrend(uptrendHighs, uptrendLows, uptrend, 10, 3);

  assert.equal(uptrendResult.bullish, true);
  assert.ok(uptrendResult.value < uptrend.at(-1));

  const reversal = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 108, 98, 90, 84, 80, 78, 76, 74];
  const reversalHighs = reversal.map((value, index) => value + (index > 16 ? 4 : 1.2));
  const reversalLows = reversal.map((value, index) => value - (index > 16 ? 4 : 1.2));
  const reversalResult = calcSupertrend(reversalHighs, reversalLows, reversal, 10, 3);

  assert.equal(reversalResult.bullish, false);
  assert.ok(reversalResult.value > reversal.at(-1));
});

test("calcRSIDivergence detects bullish divergence on synthetic pivot lows", () => {
  const closes = [110, 108, 106, 104, 102, 100, 98, 96, 94, 92, 90, 93, 96, 99, 97, 95, 93, 91, 89, 88, 90, 92, 94, 96];
  const lows = [109, 107, 105, 103, 101, 99, 97, 95, 93, 91, 89, 92, 95, 98, 96, 94, 92, 90, 88.5, 87.5, 89, 91, 93, 95];
  const highs = closes.map((value, index) => Math.max(value, lows[index]) + 2);
  const divergence = calcRSIDivergence(closes, highs, lows, 5, 20);

  assert.equal(divergence.bullishDiv, true);
  assert.equal(divergence.bearishDiv, false);
  assert.equal(divergence.type, "bullish");
});

test("summarizeExitPerformance ranks overall and defensive exit rules from triggered reviews", () => {
  const summary = summarizeExitPerformance([
    {
      id: "r1",
      entryPrice: 100,
      outcome: { stopHit: false, closeReturnPct: 2, maxFavorablePct: 8 },
      exitRules: [
        { rule: "ema21Loss", label: "EMA21 loss", pnlPct: 4, barsHeld: 4 },
        { rule: "macdCross", label: "MACD cross", pnlPct: 2, barsHeld: 6 },
      ],
    },
    {
      id: "r2",
      entryPrice: 100,
      outcome: { stopHit: true, closeReturnPct: -6, maxFavorablePct: 2 },
      exitRules: [
        { rule: "ema21Loss", label: "EMA21 loss", pnlPct: -1, barsHeld: 2 },
        { rule: "macdCross", label: "MACD cross", pnlPct: -4, barsHeld: 5 },
      ],
    },
  ]);

  assert.equal(summary.triggeredCount, 2);
  assert.equal(summary.bestOverallRule?.rule, "ema21Loss");
  assert.equal(summary.bestDefensiveRule?.rule, "ema21Loss");
  assert.equal(summary.leaderboard[0].avgPnlPct, 1.5);
});

test("getOteReviewTimeframes includes the active frame and its higher-timeframe companion", () => {
  assert.deepEqual(getOteReviewTimeframes("1D"), ["1D", "1W"]);
  assert.deepEqual(getOteReviewTimeframes("4H"), ["4H", "1D"]);
  assert.deepEqual(getOteReviewTimeframes("1W"), ["1W"]);
});
