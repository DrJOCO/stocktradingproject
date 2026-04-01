/* eslint-disable react-refresh/only-export-components */
// Theme constants and shared UI atoms

export const C = {
  bg: "#070d07", card: "#0b120b", border: "#182818",
  green: "#22c55e", red: "#ef4444", yellow: "#eab308",
  purple: "#a855f7", cyan: "#06b6d4", orange: "#f97316",
  dim: "#3d5c3d", mid: "#6a9a6a", light: "#c8ecc8",
  mono: "'JetBrains Mono', monospace",
  raj: "'Rajdhani', sans-serif",
};

export function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Rajdhani:wght@600;700&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body{background:${C.bg};color:${C.light};font-family:${C.mono};overflow-x:hidden}
      ::-webkit-scrollbar{width:4px}
      ::-webkit-scrollbar-track{background:#090f09}
      ::-webkit-scrollbar-thumb{background:#1a3d1a;border-radius:2px}
      @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
      @keyframes spin{to{transform:rotate(360deg)}}
      .fade{animation:fadeUp .4s ease forwards}
      input:focus,textarea:focus,select:focus{outline:none}
      input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
      select{-webkit-appearance:none}
      button{cursor:pointer;font-family:${C.mono}}
      @media(max-width:540px){
        body{font-size:14px}
      }
      @media(min-width:540px){
        body{font-size:15px}
      }
      /* Prevent zoom on input focus on iOS */
      input,select,textarea{font-size:16px!important}
      @media(max-width:540px){
        input,select,textarea{font-size:14px!important}
      }
      /* Touch-friendly buttons */
      button{min-height:36px}
      /* Wider layout on desktop */
      @media(min-width:768px){
        .app-container{max-width:600px!important}
      }
    `}</style>
  );
}

export function Chip({ label, color = C.green, bg, bd }) {
  return (
    <span style={{
      background: bg || (color + "1a"),
      border: `1px solid ${bd || (color + "40")}`,
      color, fontSize: "0.57rem", padding: "1px 7px", borderRadius: 3,
      fontFamily: C.mono, letterSpacing: "0.07em", fontWeight: 700, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: 16, marginBottom: 10, ...style,
    }}>{children}</div>
  );
}

export function SecHead({ left, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <span style={{ color: C.dim, fontSize: "0.6rem", letterSpacing: "0.12em", fontFamily: C.mono }}>{left}</span>
      {right && <span style={{ color: C.dim, fontSize: "0.57rem", letterSpacing: "0.1em", fontFamily: C.mono }}>{right}</span>}
    </div>
  );
}

export function Spinner({ size = 12 }) {
  return (
    <span style={{
      width: size, height: size, border: `2px solid ${C.green}`, borderTopColor: "transparent",
      borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite",
    }} />
  );
}

export function MetricBox({ label, value, color = C.light, big = false }) {
  return (
    <div style={{
      background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6,
      padding: "9px 10px", textAlign: "center",
    }}>
      <div style={{ color: C.dim, fontSize: "0.53rem", letterSpacing: "0.1em", marginBottom: 4, fontFamily: C.mono }}>{label}</div>
      <div style={{ color, fontSize: big ? "0.82rem" : "1.0rem", fontWeight: 800, fontFamily: big ? C.raj : C.mono }}>{value}</div>
    </div>
  );
}

export function TagRow({ items }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {items.map(p => (
        <span key={p} style={{
          background: "#090f09", border: `1px solid ${C.border}`, color: C.mid,
          padding: "2px 9px", borderRadius: 4, fontSize: "0.6rem", letterSpacing: "0.06em", fontFamily: C.mono,
        }}>{p}</span>
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{
      background: "#180808", border: `1px solid ${C.red}40`, borderRadius: 8,
      padding: "12px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <span style={{ color: C.red, fontSize: "0.65rem", fontFamily: C.mono }}>! {message}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: C.dim, fontSize: "0.8rem" }}>x</button>}
    </div>
  );
}
