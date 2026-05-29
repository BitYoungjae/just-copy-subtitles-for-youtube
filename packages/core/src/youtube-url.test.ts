import { expect, test } from "bun:test";
import { classifyYouTubeUrl } from "./youtube-url";

test("classifies watch pages", () => {
  expect(classifyYouTubeUrl("https://www.youtube.com/watch?v=abc123")).toBe("watch");
  expect(classifyYouTubeUrl("https://m.youtube.com/watch?v=abc123")).toBe("watch");
});

test("classifies Shorts", () => {
  expect(classifyYouTubeUrl("https://www.youtube.com/shorts/abc123")).toBe("shorts");
  expect(classifyYouTubeUrl("https://www.youtube.com/shorts/abc123/")).toBe("shorts");
  expect(classifyYouTubeUrl("https://m.youtube.com/shorts/abc123")).toBe("shorts");
});

test("rejects non-video YouTube pages and other sites", () => {
  expect(classifyYouTubeUrl("https://www.youtube.com/")).toBe("unsupported");
  expect(classifyYouTubeUrl("https://www.youtube.com/results?search_query=x")).toBe("unsupported");
  expect(classifyYouTubeUrl("https://www.youtube.com/watch")).toBe("unsupported");
  expect(classifyYouTubeUrl("https://www.youtube.com/shorts/")).toBe("unsupported");
  expect(classifyYouTubeUrl("https://music.youtube.com/watch?v=abc123")).toBe("unsupported");
  expect(classifyYouTubeUrl("https://studio.youtube.com/watch?v=abc123")).toBe("unsupported");
  expect(classifyYouTubeUrl("https://example.com/watch?v=abc123")).toBe("unsupported");
  expect(classifyYouTubeUrl("https://notyoutube.com/watch?v=abc123")).toBe("unsupported");
  expect(classifyYouTubeUrl(undefined)).toBe("unsupported");
});
