import { useRef, useEffect } from "react";
import { Card, C, Chip } from "./ui.jsx";
// TradingView interval mapping
const TV_INTERVALS = { "1m":"1","5m":"5","15m":"15","30m":"30","1H":"60","4H":"240","1D":"D","1W":"W" };

export default function TVChart({ ticker, timeframe, assetType }) {
  const ref = useRef(null);
  const interval = TV_INTERVALS[timeframe] || "D";
  const tvSym = assetType === "Crypto" ? `BINANCE:${ticker}USDT` : ticker;

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    s.async = true;
    s.innerHTML = JSON.stringify({
      autosize: true, symbol: tvSym, interval,
      timezone: "America/New_York", theme: "dark", style: "1", locale: "en",
      backgroundColor: "#0b120b", gridColor: "#182818",
      hide_top_toolbar: false, save_image: false,
    });
    ref.current.appendChild(s);
    return () => { if (ref.current) ref.current.innerHTML = ""; };
  }, [tvSym, interval]);

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px", borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ color: C.dim, fontSize: "0.6rem", letterSpacing: "0.12em", fontFamily: C.mono }}>LIVE CHART</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: C.green, fontSize: "0.6rem", fontFamily: C.mono }}>{ticker}</span>
          <Chip label={timeframe} color={C.cyan} bg="#051414" bd={C.cyan + "40"} />
        </div>
      </div>
      <div className="tradingview-widget-container" ref={ref} style={{ height: 340, width: "100%" }}>
        <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
      </div>
    </Card>
  );
}
