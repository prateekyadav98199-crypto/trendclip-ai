"use client";
import { useRef, useState } from "react";
import { detectScenes, replaceScene, getDuration, RESOLUTIONS } from "../lib/video";

const fmt = (n) => n.toFixed(1) + "s";

export default function Home() {
  const [ref, setRef] = useState(null);
  const [refUrl, setRefUrl] = useState("");
  const [dur, setDur] = useState(0);
  const [scenes, setScenes] = useState([]);
  const [sel, setSel] = useState(0);
  const [clip, setClip] = useState(null);
  const [clipDur, setClipDur] = useState(0);
  const [mode, setMode] = useState("loop");
  const [keepAudio, setKeepAudio] = useState(false);
  const [busy, setBusy] = useState("");
  const [pct, setPct] = useState(0);
  const [outUrl, setOutUrl] = useState("");
  const [split, setSplit] = useState(50);
  const [caption, setCaption] = useState("");
  const [res, setRes] = useState("1080p");
  const [fps, setFps] = useState(30);
  const vA = useRef(), vB = useRef();

  async function onRef(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRef(file); setRefUrl(url); setOutUrl(""); setScenes([]);
    const d = await getDuration(url); setDur(d);
    setBusy("Detecting scenes (first run downloads the video engine)…");
    try { setScenes(await detectScenes(file, d)); setSel(0); }
    catch (e) { alert("Scene detection failed: " + e.message); }
    setBusy("");
  }
  async function onClip(file) {
    if (!file) return;
    setClip(file); setClipDur(await getDuration(URL.createObjectURL(file)));
  }
  async function replace() {
    const sc = scenes[sel]; setBusy("Rendering quick preview…"); setPct(0);
    try {
      const url = await replaceScene({ ref, clip, s: sc.start, e: sc.end, duration: dur, clipDur, mode, keepAudio, onProgress: setPct, res: "720p", fps: 30, crf: 28 });
      setOutUrl(url);
    } catch (e) { alert("Render failed: " + e.message); }
    setBusy("");
  }
  async function exportVideo() {
    const sc = scenes[sel]; setBusy(`Exporting ${RESOLUTIONS[res].label} @ ${fps} FPS…`); setPct(0);
    try {
      const url = await replaceScene({ ref, clip, s: sc.start, e: sc.end, duration: dur, clipDur, mode, keepAudio, onProgress: setPct, res, fps, crf: 20 });
      const a = document.createElement("a");
      a.href = url; a.download = `trendclip-${res}-${fps}fps.mp4`; a.click();
    } catch (e) { alert("Export failed (4K and 60 FPS need a lot of memory; try 1080p or a shorter video): " + e.message); }
    setBusy("");
  }
  const playBoth = () => { [vA.current, vB.current].forEach((v) => v && (v.paused ? v.play() : v.pause())); };

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">TrendClip AI</h1>
        <span className="text-sm text-white/50">Turn your own footage into trend-ready short videos.</span>
      </header>

      <section className="glass p-6 grid gap-4 sm:grid-cols-2">
        <label className="border-2 border-dashed border-white/20 rounded-2xl p-6 text-center cursor-pointer hover:border-accent transition">
          <div className="font-semibold">1. Upload Trending Video</div>
          <div className="text-xs text-white/50 mt-1">{ref ? ref.name : "Drop or click to choose"}</div>
          <input type="file" accept="video/*" hidden onChange={(e) => onRef(e.target.files[0])} />
        </label>
        <label className="border-2 border-dashed border-white/20 rounded-2xl p-6 text-center cursor-pointer hover:border-accent transition">
          <div className="font-semibold">3. Add My Clip</div>
          <div className="text-xs text-white/50 mt-1">{clip ? `${clip.name} (${fmt(clipDur)})` : "Drop or click to choose"}</div>
          <input type="file" accept="video/*" hidden onChange={(e) => onClip(e.target.files[0])} />
        </label>
      </section>

      {busy && <div className="glass p-4 text-sm">{busy} {pct > 0 && `${pct}%`}
        <div className="h-2 bg-white/10 rounded mt-2"><div className="h-2 rounded bg-gradient-to-r from-accent to-accent2" style={{ width: pct + "%" }} /></div></div>}

      {scenes.length > 0 && (
        <section className="glass p-6 space-y-4">
          <h2 className="font-semibold">2. Select the scene to replace</h2>
          <div className="flex gap-1 h-14 rounded-xl overflow-hidden">
            {scenes.map((s, i) => (
              <button key={i} onClick={() => setSel(i)} style={{ flex: s.end - s.start }}
                className={`text-xs transition ${i === sel ? "bg-gradient-to-b from-accent to-accent2" : "bg-white/10 hover:bg-white/20"}`}>
                {i + 1}<br />{fmt(s.end - s.start)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="btn" onClick={() => setSel(0)}>REPLACE FIRST CLIP</button>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="bg-white/10 rounded-lg p-2 text-sm">
              <option value="loop">Auto-cut / loop to fit</option>
              <option value="stretch">Speed up / slow down to fit</option>
            </select>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} />
              Keep reference audio (only if you have rights)
            </label>
            <button className="btn ml-auto" disabled={!clip || !!busy} onClick={replace}>4. Replace Scene {sel + 1}</button>
          </div>
        </section>
      )}

      {outUrl && (
        <section className="glass p-6 space-y-4">
          <h2 className="font-semibold">5. Before / After (720p preview)</h2>
          <div className="relative mx-auto aspect-[9/16] max-h-[70vh] bg-black rounded-2xl overflow-hidden">
            <video ref={vB} src={outUrl} className="absolute inset-0 w-full h-full object-cover" loop playsInline />
            <video ref={vA} src={refUrl} muted className="absolute inset-0 w-full h-full object-cover" loop playsInline
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
            <div className="absolute top-0 bottom-0 w-0.5 bg-white" style={{ left: split + "%" }} />
            {caption && <div className="absolute bottom-16 w-full text-center text-2xl font-extrabold drop-shadow-[0_2px_4px_#000] px-4">{caption}</div>}
          </div>
          <input type="range" min="0" max="100" value={split} onChange={(e) => setSplit(+e.target.value)} className="w-full" />
          <div className="flex gap-3 flex-wrap">
            <button className="btn" onClick={playBoth}>Play / Pause</button>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption preview text"
              className="flex-1 bg-white/10 rounded-lg px-3 text-sm min-w-[180px]" />
          </div>
          <div className="flex gap-3 flex-wrap items-center border-t border-white/10 pt-4">
            <span className="font-semibold">Export</span>
            <select value={res} onChange={(e) => setRes(e.target.value)} className="bg-white/10 rounded-lg p-2 text-sm">
              {Object.entries(RESOLUTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={fps} onChange={(e) => setFps(+e.target.value)} className="bg-white/10 rounded-lg p-2 text-sm">
              {[24, 30, 60].map((f) => <option key={f} value={f}>{f} FPS</option>)}
            </select>
            <button className="btn ml-auto" disabled={!!busy} onClick={exportVideo}>Export MP4</button>
          </div>
          {res === "4k" && <p className="text-xs text-yellow-300/80">4K runs in your browser and can be slow or run out of memory, especially at 60 FPS. Use short clips, or move rendering to a server for long videos.</p>}
        </section>
      )}
    </main>
  );
}
