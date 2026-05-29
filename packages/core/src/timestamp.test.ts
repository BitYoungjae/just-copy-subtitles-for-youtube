import { expect, test } from "bun:test";
import { formatTimestamp } from "./timestamp";

test("formats sub-hour offsets as m:ss", () => {
  expect(formatTimestamp(0)).toBe("0:00");
  expect(formatTimestamp(7000)).toBe("0:07");
  expect(formatTimestamp(754_000)).toBe("12:34");
});

test("formats hour-plus offsets as h:mm:ss", () => {
  expect(formatTimestamp(3_725_000)).toBe("1:02:05");
});

test("floors sub-second remainders", () => {
  expect(formatTimestamp(1999)).toBe("0:01");
});
