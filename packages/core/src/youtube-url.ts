import type { YouTubePageKind } from "./types";

/**
 * Classify a tab URL into the YouTube surfaces we copy from (SPEC §4).
 * Watch pages (incl. finished-livestream replays) and Shorts are copyable;
 * everything else (home, search, other sites) is not.
 */
export function classifyYouTubeUrl(url: string | undefined): YouTubePageKind {
  if (url === undefined) return "unsupported";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "unsupported";
  }

  if (!isSupportedYouTubeHost(parsed.hostname)) return "unsupported";
  if (parsed.pathname === "/watch" && parsed.searchParams.has("v")) return "watch";
  if (/^\/shorts\/[^/]+\/?$/.test(parsed.pathname)) return "shorts";
  return "unsupported";
}

function isSupportedYouTubeHost(hostname: string): boolean {
  return (
    hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "m.youtube.com"
  );
}
