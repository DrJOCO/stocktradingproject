import { useState, useEffect } from "react";
import { C, Card, SecHead, Chip } from "./ui.jsx";
import { getAccountSettings, saveAccountSettings } from "../utils/storage.js";

export default function PositionSizer({ d }) {
  const [settings, setSettings] = useState(getAccountSettings());

  useEffect(() => { saveAccountSettings(settings); }, [settings]);

  const entry = d.entry;
  const atrAbs = entry * (d.atrPct / 100);
  const isShort = d.signal.includes("SHORT");

  // Stop levels
  const stops = [
    { label: "TIGHT", mult: 1.0, desc: "1x ATR — aggressive" },
    { label: "NORMAL", mult: 1.8, desc: "1.8x ATR — standard" },
    { label: "WIDE", mult: 2.5, desc: "2.5x ATR — conservative" },
  ].map(s => {
    const stopPrice = isShort ? entry + atrAbs * s.mult : entry - atrAbs * s.mult;
    const riskPerShare = Math.abs(entry - stopPrice);
    const shares = riskPerShare > 0 ? Math.floor((settings.size * (settings.riskPct / 100)) / riskPerShare) : 0;
    const positionValue = shares * entry;
    const pctOfAccount = settings.size > 0 ? (positionValue / settings.size * 100).toFixed(1) : 0;
    const dollarRisk = (shares * riskPerShare).toFixed(0);
    const target = isShort ? entry - atrAbs * s.mult * 2 : entry + atrAbs * s.mult * 2;
    const rr = riskPerShare > 0 ? (Math.abs(target - entry) / riskPerShare).toFixed(1) : "0";
    return { ...s, stopPrice: parseFloat(stopPrice.toFixed(2)), shares, positionValue, pctOfAccount, dollarRisk, rr, target: parseFloat(target.toFixed(2)) };
  });

  const trailingStop = parseFloat((atrAbs * 2).toFixed(2));

  return (
    <Card>
      <SecHead left="POSITION SIZING" right="RISK MANAGEMENT" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", fontFamily: C.mono }}>ACCOUNT SIZE</label>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: C.green, fontSize: "0.8rem", fontFamily: C.mono }}>$</span>
            <input type="number" value={settings.size} onChange={e => setSettings(s => ({ ...s, size: Number(e.target.value) }))}
              style={{ flex: 1, background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.8rem" }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", fontFamily: C.mono }}>RISK PER TRADE</label>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="number" value={settings.riskPct} step="0.5" min="0.5" max="10"
              onChange={e => setSettings(s => ({ ...s, riskPct: Number(e.target.value) }))}
              style={{ flex: 1, background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.8rem" }} />
            <span style={{ color: C.dim, fontSize: "0.7rem", fontFamily: C.mono }}>%</span>
          </div>
        </div>
      </div>

      <div style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, marginBottom: 10, letterSpacing: "0.08em" }}>
        MAX RISK: ${(settings.size * settings.riskPct / 100).toFixed(0)} per trade · ATR: ${atrAbs.toFixed(2)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {stops.map(s => (
          <div key={s.label} style={{ background: "#090f09", border: `1px solid ${s.label === "NORMAL" ? C.green + "40" : C.border}`, borderRadius: 6, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Chip label={s.label} color={s.label === "TIGHT" ? C.orange : s.label === "NORMAL" ? C.green : C.cyan} />
                <span style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono }}>{s.desc}</span>
              </div>
              <span style={{ color: C.mid, fontSize: "0.55rem", fontFamily: C.mono }}>R:R {s.rr}:1</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
              {[
                { l: "SHARES", v: s.shares, c: C.light },
                { l: "STOP", v: `$${s.stopPrice}`, c: C.red },
                { l: "$ RISK", v: `$${s.dollarRisk}`, c: C.yellow },
                { l: "% ACCT", v: `${s.pctOfAccount}%`, c: C.mid },
              ].map(cell => (
                <div key={cell.l} style={{ textAlign: "center" }}>
                  <div style={{ color: C.dim, fontSize: "0.48rem", letterSpacing: "0.08em", fontFamily: C.mono, marginBottom: 2 }}>{cell.l}</div>
                  <div style={{ color: cell.c, fontSize: "0.75rem", fontWeight: 700, fontFamily: C.mono }}>{cell.v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#0c180c", border: `1px solid ${C.border}`, borderRadius: 5, padding: "8px 12px", marginTop: 10 }}>
        <span style={{ color: C.cyan, fontSize: "0.55rem", fontWeight: 700, fontFamily: C.mono }}>TRAILING STOP: </span>
        <span style={{ color: C.mid, fontSize: "0.57rem", fontFamily: C.mono }}>
          After 2x ATR profit, trail stop at ${trailingStop} below {isShort ? "highs" : "lows"}. Lock in gains as trend extends.
        </span>
      </div>
    </Card>
  );
}
