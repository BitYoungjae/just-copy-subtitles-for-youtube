import { expect, test } from "bun:test";
import { parseJson3 } from "./json3";

test("joins segments, keeps bracketed cues, drops empty/timing-only events", () => {
  const raw = JSON.stringify({
    events: [
      { tStartMs: 0, segs: [{ utf8: "안녕" }, { utf8: "하세요" }] },
      { tStartMs: 7000, segs: [{ utf8: "[음악]" }] },
      { tStartMs: 100 }, // timing-only -> dropped
      { tStartMs: 9000, segs: [{ utf8: "   " }] }, // whitespace -> dropped
    ],
  });

  expect(parseJson3(raw)).toEqual([
    { startMs: 0, text: "안녕하세요" },
    { startMs: 7000, text: "[음악]" },
  ]);
});

test("returns empty array on invalid JSON", () => {
  expect(parseJson3("<not json>")).toEqual([]);
});
