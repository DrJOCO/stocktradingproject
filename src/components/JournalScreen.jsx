import { useState } from "react";
import { C, Card, Chip, SecHead, MetricBox } from "./ui.jsx";
import { getTrades, saveTrade, updateTrade, deleteTrade, getJournalStats } from "../utils/storage.js";
import { SIGNALS } from "../indicators/scoring.js";

export default function JournalScreen() {
  const [trades, setTrades] = useState(getTrades());
  const [stats, setStats] = useState(getJournalStats());
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ticker: "", direction: "LONG", signal: "", entry: "", stop: "", target: "", shares: "", notes: "" });
  const [exitForm, setExitForm] = useState({ exitPrice: "", exitNotes: "" });
  const [filter, setFilter] = useState("all"); // all, open, closed

  const refresh = () => { setTrades(getTrades()); setStats(getJournalStats()); };

  const handleAdd = () => {
    if (!form.ticker || !form.entry) return;
    saveTrade({
      ticker: form.ticker.toUpperCase(),
      direction: form.direction,
      signal: form.signal,
      entry: Number(form.entry),
      stop: form.stop ? Number(form.stop) : null,
      target: form.target ? Number(form.target) : null,
      shares: form.shares ? Number(form.shares) : null,
      notes: form.notes,
      exitPrice: null, exitNotes: null, pnl: null,
    });
    setForm({ ticker: "", direction: "LONG", signal: "", entry: "", stop: "", target: "", shares: "", notes: "" });
    setShowAdd(false);
    refresh();
  };

  const handleClose = (id) => {
    const trade = trades.find(t => t.id === id);
    if (!trade || !exitForm.exitPrice) return;
    const exitP = Number(exitForm.exitPrice);
    const pnl = trade.direction === "LONG"
      ? (exitP - trade.entry) / trade.entry * 100
      : (trade.entry - exitP) / trade.entry * 100;
    const dollarPnl = trade.shares ? (trade.direction === "LONG" ? (exitP - trade.entry) : (trade.entry - exitP)) * trade.shares : null;
    updateTrade(id, {
      exitPrice: exitP,
      exitNotes: exitForm.exitNotes,
      pnl: parseFloat(pnl.toFixed(2)),
      dollarPnl: dollarPnl ? parseFloat(dollarPnl.toFixed(2)) : null,
      closedAt: new Date().toISOString(),
    });
    setEditId(null);
    setExitForm({ exitPrice: "", exitNotes: "" });
    refresh();
  };

  const handleDelete = (id) => { deleteTrade(id); refresh(); };

  const filtered = trades.filter(t => {
    if (filter === "open") return t.exitPrice == null;
    if (filter === "closed") return t.exitPrice != null;
    return true;
  });

  const inp = { background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 5, padding: "7px 8px", color: C.light, fontFamily: C.mono, fontSize: "0.75rem", width: "100%" };
  const sel = { ...inp };

  return (
    <div className="fade">
      {/* Stats */}
      {stats && (
        <Card style={{ border: `1px solid ${stats.winRate >= 50 ? C.green : C.red}20` }}>
          <SecHead left="JOURNAL STATS" right={`${stats.totalTrades} closed · ${stats.openTrades} open`} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
            <MetricBox label="WIN RATE" value={`${stats.winRate}%`} color={stats.winRate >= 50 ? C.green : C.red} />
            <MetricBox label="TOTAL P&L" value={`${stats.totalPnl > 0 ? "+" : ""}${stats.totalPnl}%`} color={stats.totalPnl > 0 ? C.green : C.red} />
            <MetricBox label="PROFIT F." value={stats.profitFactor} color={stats.profitFactor >= 1.5 ? C.green : stats.profitFactor >= 1 ? C.yellow : C.red} />
            <MetricBox label="AVG P&L" value={`${stats.avgPnl > 0 ? "+" : ""}${stats.avgPnl}%`} color={stats.avgPnl > 0 ? C.green : C.red} />
          </div>
          {/* Per-signal breakdown */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(stats.bySignal).map(([sig, data]) => {
              const wr = data.count > 0 ? Math.round(data.wins / data.count * 100) : 0;
              return (
                <Chip key={sig} label={`${sig}: ${wr}% (${data.count})`}
                  color={wr >= 50 ? C.green : C.red} bg={wr >= 50 ? "#0b2214" : "#1a0808"} />
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SecHead left="TRADE JOURNAL" />
          <button onClick={() => setShowAdd(!showAdd)} style={{
            background: "#0d2a18", border: `1px solid ${C.green}`, color: C.green,
            borderRadius: 5, padding: "5px 14px", fontSize: "0.6rem", fontFamily: C.mono, fontWeight: 700,
          }}>+ LOG TRADE</button>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {["all", "open", "closed"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "#0d2a18" : "transparent",
              border: `1px solid ${filter === f ? C.green : C.border}`,
              color: filter === f ? C.green : C.dim,
              borderRadius: 4, padding: "3px 10px", fontSize: "0.55rem", fontFamily: C.mono, textTransform: "uppercase",
            }}>{f} {f === "open" && trades.filter(t => !t.exitPrice).length > 0 ? `(${trades.filter(t => !t.exitPrice).length})` : ""}</button>
          ))}
        </div>

        {/* Add form */}
        {showAdd && (
          <div style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 7, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 8 }}>
              <input placeholder="TICKER" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} style={inp} />
              <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} style={sel}>
                <option value="LONG">LONG</option><option value="SHORT">SHORT</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 8 }}>
              <input placeholder="Entry $" type="number" value={form.entry} onChange={e => setForm(f => ({ ...f, entry: e.target.value }))} style={inp} />
              <input placeholder="Stop $" type="number" value={form.stop} onChange={e => setForm(f => ({ ...f, stop: e.target.value }))} style={inp} />
              <input placeholder="Target $" type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} style={inp} />
              <input placeholder="Shares" type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} style={inp} />
            </div>
            <select value={form.signal} onChange={e => setForm(f => ({ ...f, signal: e.target.value }))} style={{ ...sel, marginBottom: 8 }}>
              <option value="">Signal type (optional)</option>
              <option>STRONG LONG</option><option>LONG BIAS</option><option>NEUTRAL</option><option>SHORT BIAS</option><option>STRONG SHORT</option>
            </select>
            <input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inp, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleAdd} style={{ flex: 1, background: "#0d2a18", border: `1px solid ${C.green}`, color: C.green, borderRadius: 5, padding: "8px 0", fontSize: "0.65rem", fontWeight: 700, fontFamily: C.mono }}>LOG ENTRY</button>
              <button onClick={() => setShowAdd(false)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 5, padding: "8px 14px", fontSize: "0.65rem", fontFamily: C.mono }}>CANCEL</button>
            </div>
          </div>
        )}

        {/* Trade list */}
        {!filtered.length && <p style={{ color: C.dim, fontSize: "0.6rem", fontFamily: C.mono, textAlign: "center", padding: "20px 0" }}>No trades logged yet. Click "+ LOG TRADE" to start tracking.</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(t => {
            const isOpen = t.exitPrice == null;
            const meta = SIGNALS[t.signal] || SIGNALS["NEUTRAL"];
            const pnlColor = t.pnl > 0 ? C.green : t.pnl < 0 ? C.red : C.dim;
            const dateStr = new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <div key={t.id} style={{ background: "#090f09", border: `1px solid ${isOpen ? C.green + "25" : C.border}`, borderRadius: 7, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: C.light, fontFamily: C.raj, fontSize: "0.9rem", fontWeight: 700 }}>{t.ticker}</span>
                    <Chip label={t.direction} color={t.direction === "LONG" ? C.green : C.red} />
                    {t.signal && <Chip label={t.signal} color={meta.color} bg={meta.color + "18"} bd={meta.color + "40"} />}
                    {isOpen && <Chip label="OPEN" color={C.cyan} bg="#051414" bd={C.cyan + "40"} />}
                  </div>
                  <span style={{ color: C.dim, fontSize: "0.5rem", fontFamily: C.mono }}>{dateStr}</span>
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>Entry: <span style={{ color: C.light }}>${t.entry}</span></span>
                  {t.stop && <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>Stop: <span style={{ color: C.red }}>${t.stop}</span></span>}
                  {t.target && <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>Target: <span style={{ color: C.green }}>${t.target}</span></span>}
                  {t.shares && <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>{t.shares} shares</span>}
                </div>

                {!isOpen && (
                  <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                    <span style={{ color: C.dim, fontSize: "0.58rem", fontFamily: C.mono }}>Exit: <span style={{ color: C.light }}>${t.exitPrice}</span></span>
                    <span style={{ color: pnlColor, fontSize: "0.65rem", fontWeight: 700, fontFamily: C.mono }}>{t.pnl > 0 ? "+" : ""}{t.pnl}%</span>
                    {t.dollarPnl != null && <span style={{ color: pnlColor, fontSize: "0.58rem", fontFamily: C.mono }}>${t.dollarPnl > 0 ? "+" : ""}{t.dollarPnl}</span>}
                  </div>
                )}

                {t.notes && <p style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, fontStyle: "italic", marginBottom: 4 }}>{t.notes}</p>}
                {t.exitNotes && <p style={{ color: C.dim, fontSize: "0.55rem", fontFamily: C.mono, fontStyle: "italic", marginBottom: 4 }}>Exit: {t.exitNotes}</p>}

                {/* Close trade form */}
                {isOpen && editId === t.id && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <input placeholder="Exit $" type="number" value={exitForm.exitPrice} onChange={e => setExitForm(f => ({ ...f, exitPrice: e.target.value }))} style={{ ...inp, flex: 1 }} />
                    <input placeholder="Notes" value={exitForm.exitNotes} onChange={e => setExitForm(f => ({ ...f, exitNotes: e.target.value }))} style={{ ...inp, flex: 1 }} />
                    <button onClick={() => handleClose(t.id)} style={{ background: "#0d2a18", border: `1px solid ${C.green}`, color: C.green, borderRadius: 5, padding: "6px 10px", fontSize: "0.55rem", fontFamily: C.mono, fontWeight: 700 }}>CLOSE</button>
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {isOpen && editId !== t.id && (
                    <button onClick={() => setEditId(t.id)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.mid, borderRadius: 4, padding: "3px 10px", fontSize: "0.53rem", fontFamily: C.mono }}>CLOSE TRADE</button>
                  )}
                  <button onClick={() => handleDelete(t.id)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 4, padding: "3px 10px", fontSize: "0.53rem", fontFamily: C.mono }}>DELETE</button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
