import { C } from "./ui.jsx";
import { saveTrade } from "../utils/storage.js";

export default function QuickLogButton({ d, onLogged }) {
  const log = () => {
    saveTrade({
      ticker: d.ticker,
      direction: d.signal.includes("SHORT") ? "SHORT" : "LONG",
      signal: d.signal,
      entry: d.entry,
      stop: d.stop,
      target: d.target,
      shares: null,
      notes: `Score ${d.score}, Conf ${d.confidence}%`,
      exitPrice: null,
      exitNotes: null,
      pnl: null,
    });

    if (onLogged) onLogged();
  };

  return (
    <button onClick={log} style={{
      background: "transparent",
      border: `1px solid ${C.border}`,
      color: C.mid,
      borderRadius: 5,
      padding: "4px 10px",
      fontSize: "0.55rem",
      fontFamily: C.mono,
    }}>
      LOG THIS TRADE
    </button>
  );
}
