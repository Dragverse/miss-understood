/**
 * Checks whether a Livepeer HLS manifest contains live segments.
 * Used as the second detection layer (after Livepeer API, before DB fallback).
 */
export async function isHLSManifestLive(playbackId: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const text = await res.text();
    return (
      text.length > 50 &&
      (text.includes(".ts") ||
        text.includes(".m4s") ||
        text.includes("#EXTINF") ||
        text.includes("#EXT-X-MEDIA-SEQUENCE"))
    );
  } catch {
    clearTimeout(timeout);
    return false;
  }
}
