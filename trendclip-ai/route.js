export const runtime = "edge";

const MAX_BYTES = 150 * 1024 * 1024; // 150 MB
const json = (error, status) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });

export async function GET(req) {
  const raw = new URL(req.url).searchParams.get("url");
  let target;
  try { target = new URL(raw); } catch { return json("That is not a valid link.", 400); }
  if (!["http:", "https:"].includes(target.protocol)) return json("Only http/https links are allowed.", 400);
  const h = target.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h))
    return json("That address is not allowed.", 400);

  let r;
  try { r = await fetch(target.toString(), { headers: { "user-agent": "TrendClipAI/1.0" } }); }
  catch { return json("Could not reach that link.", 502); }
  if (!r.ok) return json(`The link returned an error (${r.status}).`, 502);

  const type = (r.headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("video/") && !type.includes("octet-stream"))
    return json("This link is a web page, not a direct video file. Use a direct .mp4/.mov/.webm link, or upload the file.", 415);
  const len = Number(r.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return json("Video is larger than 150 MB.", 413);

  return new Response(r.body, { headers: { "content-type": type.startsWith("video/") ? type : "video/mp4" } });
}
