/**
 * Checks whether a Livepeer HLS stream is live by fetching its master playlist.
 * Used as the second detection layer (after Livepeer API, before DB fallback).
 *
 * index.m3u8 is a MASTER playlist — it contains #EXT-X-STREAM-INF rendition
 * entries, NOT #EXTINF segment markers. The old check looked for segment markers
 * which never appear in a master playlist, so it always returned false.
 *
 * The correct signal: Livepeer CDN returns 404 when the stream is offline.
 * A 200 + valid M3U8 header (#EXTM3U) means the stream is live.
 */
export async function isHLSManifestLive(playbackId: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
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
    // Any valid M3U8 (master or media) starts with #EXTM3U.
    // Presence of this header at 200 OK means the stream is live on Livepeer CDN.
    return text.length > 50 && text.includes("#EXTM3U");
  } catch {
    clearTimeout(timeout);
    return false;
  }
}
