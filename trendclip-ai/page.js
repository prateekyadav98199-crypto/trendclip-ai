"use client";
import { useRef, useState } from "react";
import { detectScenes, replaceScene, getDuration, RESOLUTIONS, COLOR_PRESETS } from "../lib/video";

const fmt = (n) => n.toFixed(1) + "s";

const LOOKS = {
  Cinematic: { color: "cinematic", motion: "zoomin", contrast: 1.1, sat: 0.95, bright: 0, fade: true },
  Vintage: { color: "vintage", motion: "none", contrast: 1.05, sat: 0.9, bright: 0.02, fade: true },
  Neon: { color: "vivid", motion: "shake", contrast: 1.15, sat: 1.5, bright: 0, fade: false },
  Clean: { color: "none", motion: "none", contrast: 1, sat: 1, bright: 0, fade: false },
};
const THEMES = { purple: "#7c5cff", ocean: "#06b6d4", sunset: "#f97316", emerald: "#10b981" };
const PLATFORM = /(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|facebook\.com|fb\.watch|twitter\.com|x\.com)/i;

function Slider({ label, value, set, min, max, step }) {
  return (
    <label className="text-xs text-white/60 block">{label}: {value}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} className="w-full" />
    </label>
  );
}

function UrlBox({ placeholder, onLoad, disabled }) {
  const [u, setU] = useState("");
  return (
    <div className="flex gap-2">
      <input value={u} onChange={(e) => setU(e.target.value)} placeholder={placeholder}
        className="flex-1 min-w-0 bg-white/10 rounded-lg px-3 py-2 text-sm" />
      <button className="btn !py-2 !px-4 text-sm" disabled={disabled || !u.trim()} onClick={() => onLoad(u.trim())}>Load</button>
    </div>
  );
}

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
  const [clipUrl, setClipUrl] = useState("");
  const [clipStart, setClipStart] = useState(0);
  const [music, setMusic] = useState(null);
  const [musicVol, setMusicVol] = useState(0.8);
  const [rights, setRights] = useState(false);
  const [motion, setMotion] = useState("none");
  const [color, setColor] = useState("none");
  const [bright, setBright] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [sat, setSat] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [fade, setFade] = useState(false);
  const fx = { motion, color, bright, contrast, sat, speed, fade };
  const applyLook = (l) => { setColor(l.color); setMotion(l.motion); setContrast(l.contrast); setSat(l.sat); setBright(l.bright); setFade(l.fade); };
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
  async function loadUrl(u, kind) {
    if (PLATFORM.test(u)) {
      alert("YouTube, Instagram, TikTok and similar links can't be downloaded here: those platforms don't allow it and most videos are copyrighted. Save videos you own (or have permission to use) with the platform's own tools, then upload the file. Direct .mp4 links work.");
      return;
    }
    setBusy("Downloading video from link…");
    try {
      const r = await fetch("/api/fetch-video?url=" + encodeURIComponent(u));
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Could not load that link.");
      const blob = await r.blob();
      const file = new File([blob], "linked-video.mp4", { type: blob.type || "video/mp4" });
      setBusy("");
      if (kind === "ref") await onRef(file); else await onClip(file);
    } catch (e) { setBusy(""); alert(e.message); }
  }
  async function onClip(file) {
    if (!file) return;
    const u = URL.createObjectURL(file); setClip(file); setClipUrl(u); setClipStart(0); setClipDur(await getDuration(u));
  }
  async function replace() {
    const sc = scenes[sel]; setBusy("Rendering quick preview…"); setPct(0);
    try {
      const url = await replaceScene({ ref, clip, s: sc.start, e: sc.end, duration: dur, clipDur, clipStart, mode, keepAudio, fx, music: rights ? music : null, musicVol, onProgress: setPct, res: "720p", fps: 30, crf: 28 });
      setOutUrl(url);
    } catch (e) { alert("Render failed: " + e.message); }
    setBusy("");
  }
  async function exportVideo() {
    const sc = scenes[sel]; setBusy(`Exporting ${RESOLUTIONS[res].label} @ ${fps} FPS…`); setPct(0);
    try {
      const url = await replaceScene({ ref, clip, s: sc.start, e: sc.end, duration: dur, clipDur, clipStart, mode, keepAudio, fx, music: rights ? music : null, musicVol, onProgress: setPct, res, fps, crf: 20 });
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
        <div className="flex items-center gap-3">
          <div className="flex gap-2">{Object.entries(THEMES).map(([k, c]) => (
            <button key={k} title={k} onClick={() => (document.documentElement.dataset.theme = k)} className="w-5 h-5 rounded-full border border-white/30" style={{ background: c }} />))}</div>
          <span className="text-sm text-white/50 hidden sm:block">Turn your own footage into trend-ready short videos.</span>
        </div>
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
        <UrlBox placeholder="…or paste a direct video link (.mp4)" disabled={!!busy} onLoad={(u) => loadUrl(u, "ref")} />
        <UrlBox placeholder="…or paste a direct video link (.mp4)" disabled={!!busy} onLoad={(u) => loadUrl(u, "clip")} />
      </section>

      <section className="glass p-6 space-y-4">
        <h2 className="font-semibold">Your videos</h2>
        {!refUrl && !clipUrl && <p className="text-sm text-white/50">Upload a video above and it will play here. Steps: 1) trending video → 2) pick a scene → 3) your clip → 4) Replace.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {refUrl && (
            <div className="space-y-2">
              <div className="text-sm text-white/60">Trending video ({fmt(dur)})</div>
              <video src={refUrl} controls playsInline className="w-full max-h-[50vh] rounded-xl bg-black" />
            </div>
          )}
          {clipUrl && (
            <div className="space-y-2">
              <div className="text-sm text-white/60">My clip ({fmt(clipDur)})</div>
              <video src={clipUrl} controls playsInline className="w-full max-h-[50vh] rounded-xl bg-black" />
              <label className="text-xs text-white/60 block">Start my clip at {fmt(clipStart)}
                <input type="range" min="0" max={Math.max(0, clipDur - 0.5)} step="0.1" value={clipStart}
                  onChange={(e) => setClipStart(+e.target.value)} className="w-full" />
              </label>
            </div>
          )}
        </div>
        {clipUrl && !refUrl && <p className="text-sm text-yellow-300/80">Now upload the Trending Video in box 1, then the scene editor will appear.</p>}
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

      {scenes.length > 0 && (
        <section className="glass p-6 space-y-4">
          <h2 className="font-semibold">Edit &amp; Effects <span className="text-xs font-normal text-white/50">(applied when you click Replace Scene)</span></h2>
          <div className="flex gap-2 flex-wrap">
            <span className="text-sm text-white/60 self-center">Looks:</span>
            {Object.entries(LOOKS).map(([k, l]) => <button key={k} className="btn !py-1 !px-3 text-sm" onClick={() => applyLook(l)}>{k}</button>)}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-xs text-white/60 block">Motion effect
              <select value={motion} onChange={(e) => setMotion(e.target.value)} className="w-full bg-white/10 rounded-lg p-2 text-sm text-white mt-1">
                <option value="none">None</option><option value="zoomin">Slow zoom in</option><option value="zoomout">Slow zoom out</option>
                <option value="shake">Shake</option><option value="mirror">Mirror</option>
              </select></label>
            <label className="text-xs text-white/60 block">Color effect
              <select value={color} onChange={(e) => setColor(e.target.value)} className="w-full bg-white/10 rounded-lg p-2 text-sm text-white mt-1">
                {Object.keys(COLOR_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select></label>
            <label className="text-xs text-white/60 block">Speed
              <select value={speed} onChange={(e) => setSpeed(+e.target.value)} className="w-full bg-white/10 rounded-lg p-2 text-sm text-white mt-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((v) => <option key={v} value={v}>{v === 1 ? "Normal" : v + "x"}</option>)}
              </select></label>
            <Slider label="Brightness" value={bright} set={setBright} min={-0.3} max={0.3} step={0.05} />
            <Slider label="Contrast" value={contrast} set={setContrast} min={0.5} max={1.8} step={0.05} />
            <Slider label="Saturation" value={sat} set={setSat} min={0} max={2} step={0.05} />
          </div>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={fade} onChange={(e) => setFade(e.target.checked)} /> Fade in / fade out</label>
          <div className="border-t border-white/10 pt-4 space-y-2">
            <div className="font-semibold text-sm">Music</div>
            <label className="text-sm flex items-start gap-2"><input type="checkbox" className="mt-1" checked={rights} onChange={(e) => setRights(e.target.checked)} />
              I own this music or have a license to use it</label>
            <input type="file" accept="audio/*" onChange={(e) => setMusic(e.target.files[0])} className="text-sm" />
            {music && <Slider label="Music volume" value={Math.round(musicVol * 100) + "%"} set={(v) => setMusicVol(v / 100)} min={0} max={100} step={5} />}
            <p className="text-xs text-white/50">Trending songs are almost always copyrighted. For safe music use royalty-free libraries (YouTube Audio Library, Pixabay Music, Free Music Archive) and check each track&apos;s license.</p>
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
