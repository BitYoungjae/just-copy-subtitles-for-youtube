import { formatTimestamp } from "./timestamp";
import type { Cue } from "./types";

export interface TranscriptInput {
  title: string;
  url: string;
  cues: Cue[];
}

/**
 * Assemble the clipboard text (SPEC §3):
 * a title + URL header, a blank line, then one `mm:ss␣␣text` line per cue.
 */
export function formatTranscript(input: TranscriptInput): string {
  const header = `${input.title}\n${input.url}`;
  const body = input.cues.map((cue) => `${formatTimestamp(cue.startMs)}  ${cue.text}`).join("\n");
  return `${header}\n\n${body}\n`;
}
