/** A single caption track as exposed by YouTube's player response. */
export interface CaptionTrack {
  /** Signed timedtext URL (PO-token bound to the current page session). */
  baseUrl: string;
  /** BCP-47-ish language code, e.g. "en", "ko". */
  languageCode: string;
  /** "asr" for auto-generated (speech-recognition) tracks; absent for manual. */
  kind?: string;
  /** Version-specific id: ".en" = manual, "a.en" = auto-generated. */
  vssId?: string;
  /** Human-readable track name, when available. */
  name?: string;
}

/** One subtitle cue: a start time and its text (non-speech cues like "[Music]" kept verbatim). */
export interface Cue {
  startMs: number;
  text: string;
}

/** Whether the current page is a YouTube surface we copy from. */
export type YouTubePageKind = "watch" | "shorts" | "unsupported";
