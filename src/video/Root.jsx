import { Composition } from "remotion";
import { SignalCardVideo } from "./SignalCardVideo.jsx";
import { LeaderboardVideo } from "./LeaderboardVideo.jsx";
import { SectorHeatmapVideo } from "./SectorHeatmapVideo.jsx";

// Default props for Remotion Studio preview
const defaultSignalProps = {
  ticker: "NVDA", signal: "STRONG LONG", confidence: 84, score: 78,
  entry: 142.50, stop: 135.20, target: 156.80, stopPct: "5.1", tgtPct: "10.0",
  rsi: 62, macdDir: "Bull", adx: 32, vol: 1.8, atrPct: 2.4, aboveVWAP: true, supertrend: true,
  commentary: "High conviction bullish. Buy dips into support. Trend is strong — let it run. Heavy volume — institutional activity.",
  indicators: [
    { label: "Full bull stack: price > EMA21 > EMA50 > SMA200", status: "pass" },
    { label: "Supertrend bullish — price above support", status: "pass" },
    { label: "MACD above signal line", status: "pass" },
    { label: "RSI 62 — bullish zone", status: "pass" },
    { label: "Rolling VWAP above — buyers in control", status: "pass" },
    { label: "Volume 1.8x avg — strong participation", status: "pass" },
  ],
};

const defaultLeaderboardProps = {
  title: "TOP SIGNALS",
  scanTime: "Mar 25, 3:42 PM",
  results: [
    { ticker: "NVDA", signal: "STRONG LONG", score: 82, entry: 142.50 },
    { ticker: "AVGO", signal: "STRONG LONG", score: 78, entry: 238.10 },
    { ticker: "AAPL", signal: "LONG BIAS", score: 68, entry: 252.60 },
    { ticker: "META", signal: "LONG BIAS", score: 65, entry: 612.30 },
    { ticker: "MSFT", signal: "LONG BIAS", score: 62, entry: 428.90 },
    { ticker: "XLE", signal: "SHORT BIAS", score: 35, entry: 82.40 },
    { ticker: "XOM", signal: "SHORT BIAS", score: 32, entry: 108.20 },
    { ticker: "CVX", signal: "STRONG SHORT", score: 25, entry: 152.70 },
  ],
};

const defaultSectorProps = {
  scanTime: "Mar 25, 3:42 PM",
  sectors: [
    { name: "Tech", etf: "XLK", score: 74, change: "1.2" },
    { name: "Finance", etf: "XLF", score: 62, change: "0.8" },
    { name: "Health", etf: "XLV", score: 58, change: "0.3" },
    { name: "Consumer", etf: "XLY", score: 55, change: "0.5" },
    { name: "Industry", etf: "XLI", score: 52, change: "-0.1" },
    { name: "Comms", etf: "XLC", score: 48, change: "-0.3" },
    { name: "Staples", etf: "XLP", score: 45, change: "-0.2" },
    { name: "Utilities", etf: "XLU", score: 42, change: "-0.4" },
    { name: "Material", etf: "XLB", score: 38, change: "-0.8" },
    { name: "RealEst", etf: "XLRE", score: 35, change: "-1.1" },
    { name: "Energy", etf: "XLE", score: 28, change: "-1.8" },
  ],
};

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="SignalCard"
        component={SignalCardVideo}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={defaultSignalProps}
      />
      <Composition
        id="Leaderboard"
        component={LeaderboardVideo}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={defaultLeaderboardProps}
      />
      <Composition
        id="SectorHeatmap"
        component={SectorHeatmapVideo}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={defaultSectorProps}
      />
    </>
  );
};
