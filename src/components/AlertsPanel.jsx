import { useState, useEffect } from "react";
import { C, Card, SecHead, Chip, Spinner } from "./ui.jsx";
import { getAlerts, addAlert, removeAlert } from "../utils/storage.js";
import { checkAlerts } from "../utils/alerts.js";

export function AlertNotifications({ triggered, onDismiss }) {
  if (!triggered.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
      {triggered.map((a, i) => (
        <div key={i} style={{
          background: "#0a1a0a", border: `1px solid ${C.green}50`, borderRadius: 8,
          padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
          animation: "fadeUp 0.4s ease forwards",
        }}>
          <div>
            <span style={{ color: C.green, fontSize: "0.65rem", fontWeight: 700, fontFamily: C.mono }}>ALERT: {a.ticker} </span>
            <span style={{ color: C.mid, fontSize: "0.6rem", fontFamily: C.mono }}>
              {a.type === "signal_change" && `Signal is now ${a.currentSignal}`}
              {a.type === "rsi_cross" && `RSI ${a.direction} ${a.level} (now ${a.currentRSI})`}
              {a.type === "price_cross" && `Price ${a.direction} $${a.level} (now $${a.currentPrice})`}
              {a.type === "score_threshold" && `Score hit ${a.currentScore} (threshold ${a.level})`}
            </span>
          </div>
          <button onClick={() => onDismiss(i)} style={{ background: "transparent", border: "none", color: C.dim, fontSize: "0.8rem" }}>x</button>
        </div>
      ))}
    </div>
  );
}

export function AlertSetButton({ ticker, assetType }) {
  const [show, setShow] = useState(false);
  const [type, setType] = useState("signal_change");
  const [condition, setCondition] = useState("any_long");
  const [direction, setDirection] = useState("above");
  const [level, setLevel] = useState(70);

  const save = () => {
    const alert = { ticker, assetType, type };
    if (type === "signal_change") alert.condition = condition;
    else if (type === "rsi_cross") { alert.direction = direction; alert.level = level; }
    else if (type === "price_cross") { alert.direction = direction; alert.level = level; }
    else if (type === "score_threshold") alert.level = level;
    addAlert(alert);
    setShow(false);
  };

  if (!show) {
    return (
      <button onClick={() => setShow(true)} style={{
        background: "transparent", border: `1px solid ${C.border}`, color: C.dim,
        borderRadius: 5, padding: "4px 10px", fontSize: "0.55rem", fontFamily: C.mono,
      }}>+ ALERT</button>
    );
  }

  return (
    <Card style={{ marginTop: 8 }}>
      <SecHead left={`SET ALERT — ${ticker}`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <select value={type} onChange={e => setType(e.target.value)}
          style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }}>
          <option value="signal_change">Signal Change</option>
          <option value="rsi_cross">RSI Cross</option>
          <option value="price_cross">Price Cross</option>
          <option value="score_threshold">Score Threshold</option>
        </select>

        {type === "signal_change" && (
          <select value={condition} onChange={e => setCondition(e.target.value)}
            style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }}>
            <option value="any_long">Any Long Signal</option>
            <option value="strong_long">Strong Long Only</option>
            <option value="any_short">Any Short Signal</option>
            <option value="strong_short">Strong Short Only</option>
          </select>
        )}

        {(type === "rsi_cross" || type === "price_cross") && (
          <div style={{ display: "flex", gap: 8 }}>
            <select value={direction} onChange={e => setDirection(e.target.value)}
              style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }}>
              <option value="above">Crosses Above</option>
              <option value="below">Crosses Below</option>
            </select>
            <input type="number" value={level} onChange={e => setLevel(Number(e.target.value))}
              style={{ flex: 1, background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }} />
          </div>
        )}

        {type === "score_threshold" && (
          <input type="number" value={level} onChange={e => setLevel(Number(e.target.value))} placeholder="Score >= "
            style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.7rem" }} />
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} style={{
            flex: 1, background: "#0d2a18", border: `1px solid ${C.green}`, color: C.green,
            borderRadius: 5, padding: "7px 0", fontSize: "0.65rem", fontWeight: 700, fontFamily: C.mono,
          }}>SET ALERT</button>
          <button onClick={() => setShow(false)} style={{
            background: "transparent", border: `1px solid ${C.border}`, color: C.dim,
            borderRadius: 5, padding: "7px 12px", fontSize: "0.65rem", fontFamily: C.mono,
          }}>CANCEL</button>
        </div>
      </div>
    </Card>
  );
}

export function AlertsList() {
  const [alerts, setAlerts] = useState(getAlerts());
  const handleRemove = (id) => { const updated = removeAlert(id); setAlerts(updated); };

  if (!alerts.length) return null;
  const active = alerts.filter(a => !a.triggered);
  if (!active.length) return null;

  return (
    <Card>
      <SecHead left={`ACTIVE ALERTS (${active.length})`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {active.map(a => (
          <div key={a.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 10px",
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: C.green, fontSize: "0.65rem", fontWeight: 700, fontFamily: C.mono }}>{a.ticker}</span>
              <span style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>
                {a.type === "signal_change" && a.condition?.replace("_", " ")}
                {a.type === "rsi_cross" && `RSI ${a.direction} ${a.level}`}
                {a.type === "price_cross" && `Price ${a.direction} $${a.level}`}
                {a.type === "score_threshold" && `Score >= ${a.level}`}
              </span>
            </div>
            <button onClick={() => handleRemove(a.id)} style={{ background: "transparent", border: "none", color: C.dim, fontSize: "0.7rem" }}>x</button>
          </div>
        ))}
      </div>
    </Card>
  );
}
