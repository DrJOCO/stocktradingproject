// localStorage wrapper plus optional Firebase cloud sync

import { firebaseEnabled, getFirestoreRuntime } from "../lib/firebase.js";

const PREFIX = "sa_";
const STORAGE_EVENT = "sa:storage";
const META_KEY = "meta";
const CLOUD_SCHEMA_VERSION = 1;

const DEFAULT_SCREENER_STATE = {
  watchlist: null,
  customTickers: "",
  timeframe: "1D",
  confirmMode: "AUTO",
  sortBy: "score",
  minScore: 60,
  results: null,
  scanTime: null,
};

const DEFAULT_MORNING_BRIEF_STATE = {
  source: "Mega Cap Tech",
  customTickers: "",
  timeframe: "1D",
  confirmMode: "AUTO",
  sortBy: "score",
  topCount: 3,
  limit: 10,
  sourceLabel: "Mega Cap Tech",
  tickers: [],
  assetType: "US Stock",
  scannedCount: 0,
  failures: [],
  results: null,
  topResults: null,
  summaryPost: "",
  threadStarter: "",
  replyDrafts: [],
  runTime: null,
};

const DEFAULT_ACCOUNT = { size: 25000, riskPct: 2 };
const DEFAULT_PORTFOLIO_POSITIONS = [];
const DEFAULT_RECENT_ANALYSES = [];
const DEFAULT_MORNING_BRIEF_HISTORY = [];
const MAX_RECENT_ANALYSES = 40;
const MAX_MORNING_BRIEF_HISTORY = 20;

let cloudUserId = null;
let cloudUnsubscribe = null;
let cloudFlushTimer = null;
let lastPushedUpdatedAt = null;
let applyingCloudState = false;

function getRaw(key, fallback = null) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function setRaw(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (error) {
    return error;
  }
}

function removeRaw(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (error) {
    return error;
  }
}

function emitStorageEvent(origin, keys = []) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, {
    detail: { origin, keys, at: Date.now() },
  }));
}

export function subscribeStorage(listener) {
  if (typeof window === "undefined") return () => {};
  const handler = (event) => listener(event.detail || {});
  window.addEventListener(STORAGE_EVENT, handler);
  return () => window.removeEventListener(STORAGE_EVENT, handler);
}

function getMeta() {
  return getRaw(META_KEY, { updatedAt: null });
}

function setMeta(meta) {
  setRaw(META_KEY, meta);
}

function touchMeta(updatedAt = new Date().toISOString()) {
  const meta = { updatedAt };
  setMeta(meta);
  return meta;
}

function buildLocalBundle() {
  return {
    watchlists: getWatchlists(),
    lastWatchlist: getLastWatchlist(),
    screenerState: getScreenerState(),
    morningBriefState: getMorningBriefState(),
    morningBriefHistory: getMorningBriefHistory(),
    account: getAccountSettings(),
    alerts: getAlerts(),
    trades: getTrades(),
    portfolioPositions: getPortfolioPositions(),
    recentAnalyses: getRecentAnalyses(),
  };
}

function normalizeBundle(data = {}) {
  return {
    watchlists: data.watchlists && typeof data.watchlists === "object" ? data.watchlists : {},
    lastWatchlist: typeof data.lastWatchlist === "string" ? data.lastWatchlist : null,
    screenerState: { ...DEFAULT_SCREENER_STATE, ...(data.screenerState || {}) },
    morningBriefState: { ...DEFAULT_MORNING_BRIEF_STATE, ...(data.morningBriefState || {}) },
    morningBriefHistory: Array.isArray(data.morningBriefHistory) ? data.morningBriefHistory.slice(0, MAX_MORNING_BRIEF_HISTORY) : DEFAULT_MORNING_BRIEF_HISTORY,
    account: { ...DEFAULT_ACCOUNT, ...(data.account || {}) },
    alerts: Array.isArray(data.alerts) ? data.alerts : [],
    trades: Array.isArray(data.trades) ? data.trades : [],
    portfolioPositions: Array.isArray(data.portfolioPositions) ? data.portfolioPositions : DEFAULT_PORTFOLIO_POSITIONS,
    recentAnalyses: Array.isArray(data.recentAnalyses) ? data.recentAnalyses : DEFAULT_RECENT_ANALYSES,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
  };
}

function buildPersistedState(bundle, updatedAt = new Date().toISOString()) {
  return {
    schemaVersion: CLOUD_SCHEMA_VERSION,
    updatedAt,
    watchlists: bundle.watchlists || {},
    lastWatchlist: bundle.lastWatchlist || null,
    screenerState: { ...DEFAULT_SCREENER_STATE, ...(bundle.screenerState || {}) },
    morningBriefState: { ...DEFAULT_MORNING_BRIEF_STATE, ...(bundle.morningBriefState || {}) },
    morningBriefHistory: Array.isArray(bundle.morningBriefHistory) ? bundle.morningBriefHistory.slice(0, MAX_MORNING_BRIEF_HISTORY) : DEFAULT_MORNING_BRIEF_HISTORY,
    account: { ...DEFAULT_ACCOUNT, ...(bundle.account || {}) },
    alerts: Array.isArray(bundle.alerts) ? bundle.alerts : [],
    trades: Array.isArray(bundle.trades) ? bundle.trades : [],
    portfolioPositions: Array.isArray(bundle.portfolioPositions) ? bundle.portfolioPositions : DEFAULT_PORTFOLIO_POSITIONS,
    recentAnalyses: Array.isArray(bundle.recentAnalyses) ? bundle.recentAnalyses.slice(0, MAX_RECENT_ANALYSES) : DEFAULT_RECENT_ANALYSES,
  };
}

function hasMeaningfulLocalState(bundle) {
  if (Object.keys(bundle.watchlists || {}).length) return true;
  if (bundle.lastWatchlist) return true;
  if (bundle.screenerState?.watchlist) return true;
  if (bundle.screenerState?.customTickers) return true;
  if (bundle.screenerState?.results) return true;
  if (bundle.screenerState?.scanTime) return true;
  if (bundle.morningBriefState?.results?.length) return true;
  if (bundle.morningBriefState?.runTime) return true;
  if (bundle.morningBriefHistory?.length) return true;
  if ((bundle.account?.size ?? DEFAULT_ACCOUNT.size) !== DEFAULT_ACCOUNT.size) return true;
  if ((bundle.account?.riskPct ?? DEFAULT_ACCOUNT.riskPct) !== DEFAULT_ACCOUNT.riskPct) return true;
  if (bundle.alerts?.length) return true;
  if (bundle.trades?.length) return true;
  if (bundle.portfolioPositions?.length) return true;
  if (bundle.recentAnalyses?.length) return true;
  return false;
}

async function pushLocalStateToCloud(updatedAt = getMeta().updatedAt || new Date().toISOString()) {
  if (!firebaseEnabled || !cloudUserId || applyingCloudState) return;
  const { db, firestoreMod } = await getFirestoreRuntime();
  const payload = buildPersistedState(buildLocalBundle(), updatedAt);
  lastPushedUpdatedAt = updatedAt;
  const cloudRef = firestoreMod.doc(db, "users", cloudUserId, "state", "app");
  await firestoreMod.setDoc(cloudRef, payload, { merge: true });
}

function scheduleCloudFlush(updatedAt) {
  if (!firebaseEnabled || !cloudUserId || applyingCloudState) return;
  if (cloudFlushTimer) clearTimeout(cloudFlushTimer);
  cloudFlushTimer = setTimeout(() => {
    pushLocalStateToCloud(updatedAt).catch(() => {});
  }, 350);
}

function applyBundleToLocal(bundle, origin = "cloud") {
  const normalized = normalizeBundle(bundle);
  applyingCloudState = true;
  try {
    setRaw("watchlists", normalized.watchlists);
    setRaw("lastWatchlist", normalized.lastWatchlist);
    setRaw("screenerState", normalized.screenerState);
    setRaw("morningBriefState", normalized.morningBriefState);
    setRaw("morningBriefHistory", normalized.morningBriefHistory);
    setRaw("account", normalized.account);
    setRaw("alerts", normalized.alerts);
    setRaw("trades", normalized.trades);
    setRaw("portfolioPositions", normalized.portfolioPositions);
    setRaw("recentAnalyses", normalized.recentAnalyses);
    setMeta({ updatedAt: normalized.updatedAt || new Date().toISOString() });
  } finally {
    applyingCloudState = false;
  }

  emitStorageEvent(origin, ["watchlists", "lastWatchlist", "screenerState", "morningBriefState", "morningBriefHistory", "account", "alerts", "trades", "portfolioPositions", "recentAnalyses"]);
}

function writeKey(key, value, origin = "local") {
  setRaw(key, value);
  if (origin === "local") {
    const meta = touchMeta();
    scheduleCloudFlush(meta.updatedAt);
  }
  emitStorageEvent(origin, [key]);
}

function removeKey(key, origin = "local") {
  removeRaw(key);
  if (origin === "local") {
    const meta = touchMeta();
    scheduleCloudFlush(meta.updatedAt);
  }
  emitStorageEvent(origin, [key]);
}

export async function attachCloudSync(user) {
  if (!firebaseEnabled || !user?.uid) {
    return { enabled: false, source: "local" };
  }

  const { db, firestoreMod } = await getFirestoreRuntime();
  cloudUserId = user.uid;
  if (cloudUnsubscribe) cloudUnsubscribe();
  if (cloudFlushTimer) clearTimeout(cloudFlushTimer);

  const cloudRef = firestoreMod.doc(db, "users", user.uid, "state", "app");
  const localBundle = buildLocalBundle();
  const localUpdatedAt = getMeta().updatedAt;
  let source = "empty";

  const snapshot = await firestoreMod.getDoc(cloudRef);
  if (snapshot.exists()) {
    const remote = normalizeBundle(snapshot.data());
    if (remote.updatedAt && (!localUpdatedAt || remote.updatedAt > localUpdatedAt)) {
      applyBundleToLocal(remote, "hydrate");
      source = "cloud";
    } else if (hasMeaningfulLocalState(localBundle)) {
      await pushLocalStateToCloud(localUpdatedAt || new Date().toISOString());
      source = "local";
    } else {
      applyBundleToLocal(remote, "hydrate");
      source = "cloud";
    }
  } else if (hasMeaningfulLocalState(localBundle)) {
    await pushLocalStateToCloud(localUpdatedAt || new Date().toISOString());
    source = "local";
  }

  cloudUnsubscribe = firestoreMod.onSnapshot(cloudRef, (remoteSnapshot) => {
    if (!remoteSnapshot.exists()) return;
    const remote = normalizeBundle(remoteSnapshot.data());
    const currentLocalUpdatedAt = getMeta().updatedAt;
    if (!remote.updatedAt) return;
    if (remote.updatedAt === currentLocalUpdatedAt) return;
    if (remote.updatedAt === lastPushedUpdatedAt) return;
    if (!currentLocalUpdatedAt || remote.updatedAt > currentLocalUpdatedAt) {
      applyBundleToLocal(remote, "cloud");
    }
  });

  emitStorageEvent("auth", ["cloud"]);
  return { enabled: true, source };
}

export function detachCloudSync() {
  if (cloudUnsubscribe) cloudUnsubscribe();
  if (cloudFlushTimer) clearTimeout(cloudFlushTimer);
  cloudUnsubscribe = null;
  cloudFlushTimer = null;
  cloudUserId = null;
  lastPushedUpdatedAt = null;
  emitStorageEvent("auth", ["cloud"]);
}

// --- Watchlists ---
export function getWatchlists() {
  return getRaw("watchlists", {});
}

export function saveWatchlist(name, tickers) {
  const wl = getWatchlists();
  wl[name] = tickers;
  writeKey("watchlists", wl);
  return wl;
}

export function deleteWatchlist(name) {
  const wl = getWatchlists();
  delete wl[name];
  writeKey("watchlists", wl);
  return wl;
}

export function getLastWatchlist() {
  return getRaw("lastWatchlist", null);
}

export function setLastWatchlist(name) {
  writeKey("lastWatchlist", name);
  return name;
}

// --- Screener ---
export function getScreenerState() {
  return { ...DEFAULT_SCREENER_STATE, ...(getRaw("screenerState", DEFAULT_SCREENER_STATE) || {}) };
}

export function saveScreenerState(state) {
  writeKey("screenerState", { ...DEFAULT_SCREENER_STATE, ...state });
  return state;
}

export function clearScreenerState() {
  removeKey("screenerState");
}

// --- Morning Brief ---
export function getMorningBriefState() {
  return { ...DEFAULT_MORNING_BRIEF_STATE, ...(getRaw("morningBriefState", DEFAULT_MORNING_BRIEF_STATE) || {}) };
}

export function saveMorningBriefState(state) {
  writeKey("morningBriefState", { ...DEFAULT_MORNING_BRIEF_STATE, ...state });
  return state;
}

export function clearMorningBriefState() {
  removeKey("morningBriefState");
}

export function getMorningBriefHistory() {
  return getRaw("morningBriefHistory", DEFAULT_MORNING_BRIEF_HISTORY);
}

export function saveMorningBriefHistory(entries) {
  const normalized = Array.isArray(entries) ? entries.slice(0, MAX_MORNING_BRIEF_HISTORY) : DEFAULT_MORNING_BRIEF_HISTORY;
  writeKey("morningBriefHistory", normalized);
  return normalized;
}

export function addMorningBriefRun(entry) {
  if (!entry?.runTime) return getMorningBriefHistory();

  const nextEntry = {
    id: entry.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...entry,
  };

  const entries = [
    nextEntry,
    ...getMorningBriefHistory().filter((item) => item.runTime !== nextEntry.runTime),
  ].slice(0, MAX_MORNING_BRIEF_HISTORY);

  saveMorningBriefHistory(entries);
  return entries;
}

export function clearMorningBriefHistory() {
  removeKey("morningBriefHistory");
}

// --- Account Settings ---
export function getAccountSettings() {
  return { ...DEFAULT_ACCOUNT, ...(getRaw("account", DEFAULT_ACCOUNT) || {}) };
}

export function saveAccountSettings(settings) {
  writeKey("account", { ...DEFAULT_ACCOUNT, ...settings });
  return settings;
}

// --- Alerts ---
export function getAlerts() {
  return getRaw("alerts", []);
}

export function saveAlerts(alerts) {
  writeKey("alerts", alerts);
  return alerts;
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
  return getRaw("trades", []);
}

export function saveTrade(trade) {
  const trades = getTrades();
  trades.unshift({ ...trade, id: Date.now(), createdAt: new Date().toISOString() });
  writeKey("trades", trades);
  return trades;
}

export function updateTrade(id, updates) {
  const trades = getTrades().map(t => t.id === id ? { ...t, ...updates } : t);
  writeKey("trades", trades);
  return trades;
}

export function deleteTrade(id) {
  const trades = getTrades().filter(t => t.id !== id);
  writeKey("trades", trades);
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

// --- Portfolio Positions ---
export function getPortfolioPositions() {
  return getRaw("portfolioPositions", DEFAULT_PORTFOLIO_POSITIONS);
}

export function savePortfolioPositions(positions) {
  writeKey("portfolioPositions", Array.isArray(positions) ? positions : DEFAULT_PORTFOLIO_POSITIONS);
  return positions;
}

export function clearPortfolioPositions() {
  removeKey("portfolioPositions");
}

// --- Recent Analysis History ---
export function getRecentAnalyses() {
  return getRaw("recentAnalyses", DEFAULT_RECENT_ANALYSES);
}

export function saveRecentAnalyses(entries) {
  const normalized = Array.isArray(entries) ? entries.slice(0, MAX_RECENT_ANALYSES) : DEFAULT_RECENT_ANALYSES;
  writeKey("recentAnalyses", normalized);
  return normalized;
}

export function addRecentAnalysis(entry) {
  if (!entry?.ticker || !entry?.timeframe) return getRecentAnalyses();

  const nextEntry = {
    id: entry.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    analyzedAt: entry.analyzedAt || new Date().toISOString(),
    ...entry,
  };

  const entries = [
    nextEntry,
    ...getRecentAnalyses().filter((item) => item.id !== nextEntry.id),
  ].slice(0, MAX_RECENT_ANALYSES);

  saveRecentAnalyses(entries);
  return entries;
}

export function clearRecentAnalyses() {
  removeKey("recentAnalyses");
}
