import { useState } from "react";
import { Player } from "@remotion/player";
import { C, Card, SecHead, Chip } from "./ui.jsx";
import { SignalCardVideo } from "../video/SignalCardVideo.jsx";
import { LeaderboardVideo } from "../video/LeaderboardVideo.jsx";
import { SectorHeatmapVideo } from "../video/SectorHeatmapVideo.jsx";

export function VideoExportButton({ type, props, label }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const compositions = {
    signal: { component: SignalCardVideo, id: "SignalCard", file: "signal-card" },
    leaderboard: { component: LeaderboardVideo, id: "Leaderboard", file: "leaderboard" },
    heatmap: { component: SectorHeatmapVideo, id: "SectorHeatmap", file: "sector-heatmap" },
  };

  const comp = compositions[type];
  if (!comp) return null;

  const copyCmd = () => {
    const renderCmd = `cd ~/stocktradingproject && npx remotion render src/video/index.js ${comp.id} out/${comp.file}-${Date.now()}.mp4 --props='${JSON.stringify(props)}'`;
    navigator.clipboard.writeText(renderCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      <SecHead left="VIDEO PREVIEW" right="1080x1080 · 30fps" />

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
        <div style={{ color: C.dim, fontSize: "0.5rem", letterSpacing: "0.1em", fontFamily: C.mono, marginBottom: 4 }}>RENDER COMMAND</div>
        <code style={{ color: C.mid, fontSize: "0.52rem", fontFamily: C.mono, lineHeight: 1.5, wordBreak: "break-all", display: "block" }}>
          npx remotion render src/video/index.js {comp.id} out/{comp.file}.mp4
        </code>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={copyCmd} style={{
          flex: 1, background: "#0d2a18", border: `1px solid ${C.green}`, color: C.green,
          borderRadius: 5, padding: "8px 0", fontSize: "0.6rem", fontWeight: 700, fontFamily: C.mono,
        }}>
          {copied ? "COPIED!" : "COPY FULL RENDER CMD"}
        </button>
        <button onClick={() => setShow(false)} style={{
          background: "transparent", border: `1px solid ${C.border}`, color: C.dim,
          borderRadius: 5, padding: "8px 14px", fontSize: "0.6rem", fontFamily: C.mono,
        }}>CLOSE</button>
      </div>
    </Card>
  );
}
