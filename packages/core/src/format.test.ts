import { expect, test } from "bun:test";
import { formatTranscript } from "./format";

test("assembles header, blank line, and timestamped lines", () => {
  const out = formatTranscript({
    title: "My Video",
    url: "https://www.youtube.com/watch?v=abc123",
    cues: [
      { startMs: 0, text: "hello" },
      { startMs: 7000, text: "[Music]" },
    ],
  });

  expect(out).toBe(
    "My Video\nhttps://www.youtube.com/watch?v=abc123\n\n0:00  hello\n0:07  [Music]\n",
  );
});
