import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ff = null;
export async function getFFmpeg(onLog) {
  if (!ff) {
    ff = new FFmpeg();
    const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
    });
  }
  ff.off && ff.off("log", ff.__l);
  if (onLog) { ff.__l = ({ message }) => onLog(message); ff.on("log", ff.__l); }
  return ff;
}

export function getDuration(url) {
  return new Promise((res) => {
    const v = document.createElement("video");
    v.preload = "metadata"; v.src = url;
    v.onloadedmetadata = () => res(v.duration);
  });
}

// Scene detection: returns [{start,end}]
export async function detectScenes(file, duration, threshold = 0.3) {
  const times = [];
  const f = await getFFmpeg((m) => {
    const t = /pts_time:([\d.]+)/.exec(m);
    if (t) times.push(parseFloat(t[1]));
  });
  await f.writeFile("ref.mp4", await fetchFile(file));
  await f.exec(["-i", "ref.mp4", "-vf", `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-"]);
  const cuts = [0, ...times.filter((t) => t > 0.3 && t < duration - 0.3), duration];
  return cuts.slice(0, -1).map((s, i) => ({ start: s, end: cuts[i + 1] }));
}

// Replace scene [s,e] of the reference with the user's clip.
export const COLOR_PRESETS = {
  none: "", vivid: "eq=saturation=1.4:contrast=1.1", warm: "colorbalance=rs=.12:gs=.02:bs=-.12",
  cool: "colorbalance=rs=-.12:bs=.12", bw: "hue=s=0,eq=contrast=1.15", vintage: "curves=preset=vintage",
  cinematic: "eq=contrast=1.15:saturation=0.9,colorbalance=rs=.06:bs=-.06",
};
const CENTER = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'";
function buildFx(fx, w, h, fps, duration) {
  const c = [];
  if (fx.motion === "zoomin") c.push(`zoompan=z='min(zoom+0.0015,1.3)':${CENTER}:d=1:s=${w}x${h}:fps=${fps}`);
  if (fx.motion === "zoomout") c.push(`zoompan=z='if(lte(on,1),1.3,max(zoom-0.0015,1))':${CENTER}:d=1:s=${w}x${h}:fps=${fps}`);
  if (fx.motion === "shake") c.push(`scale=iw*1.08:ih*1.08,crop=${w}:${h}:x='(iw-${w})/2+sin(n*1.7)*(iw-${w})/2':y='(ih-${h})/2+cos(n*2.3)*(ih-${h})/2'`);
  if (fx.motion === "mirror") c.push("hflip");
  const p = COLOR_PRESETS[fx.color || "none"]; if (p) c.push(p);
  const b = fx.bright || 0, ct = fx.contrast ?? 1, sa = fx.sat ?? 1;
  if (b !== 0 || ct !== 1 || sa !== 1) c.push(`eq=brightness=${b}:contrast=${ct}:saturation=${sa}`);
  if (fx.fade) c.push(`fade=t=in:st=0:d=0.5,fade=t=out:st=${Math.max(0, duration - 0.5).toFixed(2)}:d=0.5`);
  if (fx.speed && fx.speed !== 1) c.push(`setpts=PTS/${fx.speed}`);
  return c.join(",");
}

export const RESOLUTIONS = {
  "720p": { w: 720, h: 1280, label: "720p (720×1280)" },
  "1080p": { w: 1080, h: 1920, label: "1080p (1080×1920)" },
  "4k": { w: 2160, h: 3840, label: "4K (2160×3840)" },
};

export async function replaceScene({ ref, clip, s, e, duration, clipDur, clipStart = 0, mode, keepAudio, fx = {}, music = null, musicVol = 0.8, onProgress, res = "720p", fps = 30, crf = 28 }) {
  const f = await getFFmpeg();
  const { w, h } = RESOLUTIONS[res];
  f.off("progress", f.__p);
  f.__p = ({ progress }) => onProgress?.(Math.min(100, Math.max(0, Math.round(progress * 100))));
  f.on("progress", f.__p);
  await f.writeFile("ref.mp4", await fetchFile(ref));
  await f.writeFile("clip.mp4", await fetchFile(clip));
  if (music) await f.writeFile("music.bin", await fetchFile(music));
  const fit = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=${fps},format=yuv420p`;
  const len = e - s;
  const parts = [];
  const labels = [];
  if (s > 0.05) { parts.push(`[0:v]trim=0:${s},setpts=PTS-STARTPTS,${fit}[a]`); labels.push("[a]"); }
  const stretch = mode === "stretch" ? `setpts=PTS*${(len / Math.max(0.5, clipDur - clipStart)).toFixed(5)}` : "setpts=PTS-STARTPTS";
  parts.push(`[1:v]${stretch},trim=0:${len},setpts=PTS-STARTPTS,${fit}[b]`); labels.push("[b]");
  if (e < duration - 0.05) { parts.push(`[0:v]trim=${e}:${duration},setpts=PTS-STARTPTS,${fit}[c]`); labels.push("[c]"); }
  const chain = buildFx(fx, w, h, fps, duration);
  parts.push(`${labels.join("")}concat=n=${labels.length}:v=1:a=0` + (chain ? `[v0];[v0]${chain}[v]` : "[v]"));
  if (music) parts.push(`[2:a]volume=${musicVol},afade=t=in:d=0.5[aout]`);
  const args = ["-i", "ref.mp4", "-stream_loop", "-1", "-ss", String(clipStart), "-i", "clip.mp4",
    ...(music ? ["-stream_loop", "-1", "-i", "music.bin"] : []), "-filter_complex", parts.join(";"), "-map", "[v]"];
  if (music) args.push("-map", "[aout]", "-c:a", "aac");
  else if (keepAudio) { args.push("-map", "0:a?", "-c:a", "aac"); if (fx.speed && fx.speed !== 1) args.push("-filter:a", `atempo=${fx.speed}`); }
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", String(crf), "-r", String(fps), "-shortest", "-movflags", "+faststart", "out.mp4");
  await f.exec(args);
  const data = await f.readFile("out.mp4");
  return URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
}
