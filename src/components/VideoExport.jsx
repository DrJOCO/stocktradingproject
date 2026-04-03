import { useState } from "react";
import { Player } from "@remotion/player";
import { C, Card, SecHead, Chip } from "./ui.jsx";
import { SignalCardVideo } from "../video/SignalCardVideo.jsx";
import { LeaderboardVideo } from "../video/LeaderboardVideo.jsx";
import { SectorHeatmapVideo } from "../video/SectorHeatmapVideo.jsx";

const PROJECT_CWD = "/Users/joncheng/Documents/Documents - Jonathan’s MacBook Pro/stocktradingproject";

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildTimestampStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function getSignalFilename(props = {}) {
  const ticker = slugify(props.ticker || "signal");
  const timeframe = slugify(props.timeframe || "1d");
  const signal = slugify(props.signal || "setup");
  return `${ticker}-${timeframe}-${signal}-x-${buildTimestampStamp()}.mp4`;
}

function buildSignalCaption(props = {}) {
  const lines = [
    `${props.ticker || "Ticker"} ${props.timeframe ? `${props.timeframe} ` : ""}${props.signal || "setup"}`.trim(),
    props.heroLead || props.commentary || "",
    `Entry $${props.entry} | Stop $${props.stop} | Target $${props.target}`,
    `Score ${props.score}/100 | Confidence ${props.confidence}%`,
  ].filter(Boolean);

  if (props.suggestion) lines.push(`Plan: ${props.suggestion}`);
  lines.push("#stocks #trading #swingtrading");
  return lines.join("\n");
}

export function VideoExportButton({ type, props, label }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState("");

  const compositions = {
    signal: { component: SignalCardVideo, id: "SignalCard", file: "signal-card" },
    leaderboard: { component: LeaderboardVideo, id: "Leaderboard", file: "leaderboard" },
    heatmap: { component: SectorHeatmapVideo, id: "SectorHeatmap", file: "sector-heatmap" },
  };

  const comp = compositions[type];
  if (!comp) return null;

  const outputFile = type === "signal" ? getSignalFilename(props) : `${comp.file}-${buildTimestampStamp()}.mp4`;
  const renderCmd = `cd "${PROJECT_CWD}" && npx remotion render src/video/index.js ${comp.id} out/${outputFile} --props='${JSON.stringify(props)}'`;
  const captionText = type === "signal" ? buildSignalCaption(props) : `${comp.id} export from Signal Analyzer`;

  const copyValue = (value, key) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    });
  };

  if (!show) {
    return (
      <button onClick={() => setShow(true)} style={{
        background: "transparent", border: `1px solid ${C.cyan}40`, color: C.cyan,
        borderRadius: 5, padding: "4px 10px", fontSize: "0.55rem", fontFamily: C.mono,
      }}>{label || "VIDEO"}</button>
    );
  }

  return (
    <Card style={{ border: `1px solid ${C.cyan}30` }}>
      <SecHead left="VIDEO PREVIEW" right="1080x1080 · X READY" />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <Chip label="SQUARE POST" color={C.cyan} bg="#051414" bd={`${C.cyan}35`} />
        <Chip label="H.264 MP4" color={C.green} bg="#0b2214" bd={`${C.green}40`} />
        <Chip label="BEST FOR X FEED" color={C.yellow} bg="#191400" bd="#504400" />
      </div>

      {/* Inline player preview */}
      <div style={{ borderRadius: 8, overflow: "hidden", marginBottom: 12, border: `1px solid ${C.border}` }}>
        <Player
          component={comp.component}
          inputProps={props}
          durationInFrames={type === "leaderboard" ? 150 : 120}
          compositionWidth={1080}
          compositionHeight={1080}
          fps={30}
          style={{ width: "100%", aspectRatio: "1/1" }}
          controls
          autoPlay
          loop
        />
      </div>

      {/* Render command */}
      <div style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px", marginBottom: 10 }}>
        <div style={{ color: C.dim, fontSize: "0.5rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 4 }}>X EXPORT COMMAND</div>
        <code style={{ color: C.mid, fontSize: "0.52rem", fontFamily: C.mono, lineHeight: 1.5, wordBreak: "break-all", display: "block" }}>
          {renderCmd}
        </code>
      </div>

      <div style={{ background: "#090f09", border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px", marginBottom: 10 }}>
        <div style={{ color: C.dim, fontSize: "0.5rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 4 }}>X POST TEXT</div>
        <div style={{ color: C.mid, fontSize: "0.56rem", fontFamily: C.mono, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {captionText}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <button onClick={() => copyValue(renderCmd, "cmd")} style={{
          flex: 1, background: "#0d2a18", border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 5, padding: "8px 0", fontSize: "0.6rem", fontWeight: 700, fontFamily: C.mono,
        }}>
          {copied === "cmd" ? "CMD COPIED!" : "COPY RENDER CMD"}
        </button>
        <button onClick={() => copyValue(captionText, "caption")} style={{
          flex: 1, background: "#051414", border: `1px solid ${C.cyan}40`, color: C.cyan,
          borderRadius: 5, padding: "8px 0", fontSize: "0.6rem", fontWeight: 700, fontFamily: C.mono,
        }}>
          {copied === "caption" ? "TEXT COPIED!" : "COPY X TEXT"}
        </button>
        <button onClick={() => copyValue(outputFile, "file")} style={{
          flex: 1, background: "#101610", border: `1px solid ${C.border}`, color: C.mid,
          borderRadius: 5, padding: "8px 0", fontSize: "0.6rem", fontWeight: 700, fontFamily: C.mono,
        }}>
          {copied === "file" ? "NAME COPIED!" : "COPY FILE NAME"}
        </button>
        <button onClick={() => setShow(false)} style={{
          background: "transparent", border: `1px solid ${C.border}`, color: C.dim,
          borderRadius: 5, padding: "8px 14px", fontSize: "0.6rem", fontFamily: C.mono,
        }}>CLOSE</button>
      </div>
    </Card>
  );
}
