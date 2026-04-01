// localStorage wrapper for persistent state

const PREFIX = "sa_";

function get(key, fallback = null) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function set(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (error) {
    return error;
  }
}

function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (error) {
    return error;
  }
}

// --- Watchlists ---
export function getWatchlists() {
  return get("watchlists", {});
}

export function saveWatchlist(name, tickers) {
  const wl = getWatchlists();
  wl[name] = tickers;
  set("watchlists", wl);
}

export function deleteWatchlist(name) {
  const wl = getWatchlists();
  delete wl[name];
  set("watchlists", wl);
}

export function getLastWatchlist() {
  return get("lastWatchlist", null);
}

export function setLastWatchlist(name) {
  set("lastWatchlist", name);
}

// --- Screener ---
export function getScreenerState() {
  return get("screenerState", {
    watchlist: null,
    customTickers: "",
    timeframe: "1D",
    confirmMode: "AUTO",
    sortBy: "score",
    minScore: 60,
    results: null,
    scanTime: null,
  });
}

export function saveScreenerState(state) {
  set("screenerState", state);
}

export function clearScreenerState() {
  remove("screenerState");
}

// --- Account Settings ---
export function getAccountSettings() {
  return get("account", { size: 25000, riskPct: 2 });
}

export function saveAccountSettings(settings) {
  set("account", settings);
}

// --- Alerts ---
export function getAlerts() {
  return get("alerts", []);
}

export function saveAlerts(alerts) {
  set("alerts", alerts);
}

export function addAlert(alert) {
  const alerts = getAlerts();
  alerts.push({ ...alert, id: Date.now(), triggered: false, createdAt: new Date().toISOString() });
  saveAlerts(alerts);
  return alerts;
}

export function removeAlert(id) {
  const alerts = getAlerts().filter(a => a.id !== id);
  saveAlerts(alerts);
  return alerts;
}

export function markAlertTriggered(id) {
  const alerts = getAlerts().map(a => a.id === id ? { ...a, triggered: true } : a);
  saveAlerts(alerts);
  return alerts;
}


// --- Trade Journal ---
export function getTrades() {
  return get("trades", []);
}

export function saveTrade(trade) {
  const trades = getTrades();
  trades.unshift({ ...trade, id: Date.now(), createdAt: new Date().toISOString() });
  set("trades", trades);
  return trades;
}

export function updateTrade(id, updates) {
  const trades = getTrades().map(t => t.id === id ? { ...t, ...updates } : t);
  set("trades", trades);
  return trades;
}

export function deleteTrade(id) {
  const trades = getTrades().filter(t => t.id !== id);
  set("trades", trades);
  return trades;
}

export function getJournalStats() {
  const trades = getTrades().filter(t => t.exitPrice != null);
  if (!trades.length) return null;
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl <= 0);
  const totalPnl = trades.reduce((a, t) => a + (t.pnl || 0), 0);
  const avgPnl = totalPnl / trades.length;
  const winRate = (wins.length / trades.length) * 100;
  const avgWin = wins.length ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0) / losses.length) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
  const bySignal = {};
  for (const t of trades) {
    const s = t.signal || "UNKNOWN";
    if (!bySignal[s]) bySignal[s] = { count: 0, wins: 0, pnl: 0 };
    bySignal[s].count++;
    if (t.pnl > 0) bySignal[s].wins++;
    bySignal[s].pnl += t.pnl || 0;
  }
  return {
    totalTrades: trades.length, openTrades: getTrades().filter(t => t.exitPrice == null).length,
    winRate: parseFloat(winRate.toFixed(1)), totalPnl: parseFloat(totalPnl.toFixed(2)),
    avgPnl: parseFloat(avgPnl.toFixed(2)), avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)), profitFactor: parseFloat(Math.min(profitFactor, 99).toFixed(2)),
    bySignal,
  };
}
