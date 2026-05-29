import type { Cue } from "./types";

interface Json3Segment {
  utf8?: string;
}

interface Json3Event {
  tStartMs?: number;
  segs?: Json3Segment[];
}

interface Json3Document {
  events?: Json3Event[];
}

/**
 * Parse YouTube's `fmt=json3` timedtext payload into cues.
 * Events without text segments (timing/style-only markers) are dropped;
 * non-speech cues such as "[Music]" are preserved verbatim.
 */
export function parseJson3(raw: string): Cue[] {
  let doc: Json3Document;
  try {
    doc = JSON.parse(raw) as Json3Document;
  } catch {
    return [];
  }

  const cues: Cue[] = [];
  for (const event of doc.events ?? []) {
    if (event.segs === undefined || event.tStartMs === undefined) continue;
    const text = event.segs
      .map((seg) => seg.utf8 ?? "")
      .join("")
      .trim();
    if (text.length === 0) continue;
    cues.push({ startMs: event.tStartMs, text });
  }
  return cues;
}
