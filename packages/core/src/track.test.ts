import { expect, test } from "bun:test";
import { selectCaptionTrack } from "./track";
import type { CaptionTrack } from "./types";

const en: CaptionTrack = { baseUrl: "u-en", languageCode: "en", vssId: ".en" };
const enAsr: CaptionTrack = { baseUrl: "u-en-asr", languageCode: "en", kind: "asr", vssId: "a.en" };
const ko: CaptionTrack = { baseUrl: "u-ko", languageCode: "ko", vssId: ".ko" };

test("follows the active track when present", () => {
  expect(selectCaptionTrack([en, ko], { activeVssId: ".ko" })).toBe(ko);
});

test("falls back to default language, preferring manual over auto-generated", () => {
  expect(selectCaptionTrack([enAsr, en], { defaultLanguageCode: "en" })).toBe(en);
});

test("matches default language by primary subtag when there is no exact match", () => {
  expect(selectCaptionTrack([en, ko], { defaultLanguageCode: "en-US" })).toBe(en);
});

test("treats a-prefixed vssId as auto-generated even when kind is missing", () => {
  const asrWithoutKind: CaptionTrack = { baseUrl: "u-auto", languageCode: "en", vssId: "a.en" };

  expect(selectCaptionTrack([asrWithoutKind, en], { defaultLanguageCode: "en" })).toBe(en);
});

test("uses the first track when no hint matches", () => {
  expect(selectCaptionTrack([enAsr], {})).toBe(enAsr);
});

test("returns undefined when there are no tracks", () => {
  expect(selectCaptionTrack([], { activeVssId: ".en" })).toBeUndefined();
});
