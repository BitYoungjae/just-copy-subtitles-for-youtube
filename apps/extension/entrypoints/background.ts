import {
  classifyYouTubeUrl,
  formatTranscript,
  parseJson3,
  selectCaptionTrack,
  type CaptionTrack,
} from "@jcys/core";

const DEFAULT_TITLE = "Just Copy Subtitles for YouTube™";
const DEBUG_LOGS = false;
const DEBUG_PREFIX = "[JCYS]";

/** Shape returned by the MAIN-world reader injected into the YouTube page. */
interface RawPlayerData {
  isLive: boolean;
  title: string;
  url: string;
  defaultLanguageCode: string | undefined;
  activeVssId: string | undefined;
  potToken: string | undefined;
  client: TimedTextClientHints;
  tracks: CaptionTrack[];
}

interface TimedTextClientHints {
  clientVersion?: string | undefined;
  browserName?: string | undefined;
  browserVersion?: string | undefined;
  osName?: string | undefined;
  osVersion?: string | undefined;
}

interface TimedTextFetchAttempt {
  label: string;
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string | null;
  bytes: number;
  snippet: string;
  url: TimedTextUrlDebug;
  error?: string;
}

interface TimedTextUrlDebug {
  host: string;
  pathname: string;
  originalFmt: string | null;
  fmt: string | null;
  lang: string | null;
  kind: string | null;
  hasPot: boolean;
  hasSignature: boolean;
  paramNames: string[];
}

interface TimedTextFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string | null;
  bytes: number;
  text: string;
  snippet: string;
  url: TimedTextUrlDebug;
  attempts: TimedTextFetchAttempt[];
  error?: string;
}

interface CaptionPrimeResult {
  ok: boolean;
  methods: string[];
  beforeTrack: string | undefined;
  afterTrack: string | undefined;
  beforeButtonPressed: boolean | undefined;
  afterButtonPressed: boolean | undefined;
  timedTextResourceCount: number;
  latestTimedTextUrl: TimedTextUrlDebug | undefined;
  error?: string;
}

export default defineBackground(() => {
  debug("background loaded");

  // Keep the toolbar icon enabled only on watch/Shorts pages (SPEC §4).
  void initIcons();
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url !== undefined || changeInfo.status === "complete") {
      void refreshIcon(tabId, tab.url);
    }
  });
  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await browser.tabs.get(tabId);
    void refreshIcon(tabId, tab.url);
  });

  // On click: extract, format, copy, and report (SPEC §1-3, §5).
  browser.action.onClicked.addListener((tab) => {
    if (tab.id !== undefined) void runCopy(tab.id);
  });
});

async function initIcons(): Promise<void> {
  debug("init icons");
  await browser.action.disable(); // default: inactive everywhere
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs.map((tab) => (tab.id === undefined ? undefined : refreshIcon(tab.id, tab.url))),
  );
}

async function refreshIcon(tabId: number, url: string | undefined): Promise<void> {
  const kind = classifyYouTubeUrl(url);
  debug("refresh icon", { tabId, url, kind });
  if (kind === "unsupported") {
    await browser.action.disable(tabId);
    await browser.action.setTitle({ tabId, title: DEFAULT_TITLE });
  } else {
    await browser.action.enable(tabId);
    await browser.action.setTitle({ tabId, title: DEFAULT_TITLE });

    if ((await isCurrentYouTubePageLive(tabId)) === true) {
      debug("disable live page", { tabId });
      await browser.action.disable(tabId);
      await browser.action.setTitle({ tabId, title: "진행 중인 라이브는 지원하지 않습니다" });
    }
  }
}

async function runCopy(tabId: number): Promise<void> {
  debug("copy clicked", { tabId });
  try {
    debug("read player data", { tabId });
    const [readResult] = await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: readPlayerData,
    });
    const data = readResult?.result as RawPlayerData | null | undefined;
    debug("player data result", {
      tabId,
      hasData: data != null,
      isLive: data?.isLive,
      trackCount: data?.tracks.length,
      activeVssId: data?.activeVssId,
      defaultLanguageCode: data?.defaultLanguageCode,
      hasPotToken: data?.potToken !== undefined,
      client: data?.client,
    });

    if (data == null || data.tracks.length === 0) {
      debug("no caption tracks", { tabId });
      await fail(tabId, "이 영상에는 자막이 없습니다");
      return;
    }
    if (data.isLive) {
      debug("live page clicked", { tabId });
      await fail(tabId, "진행 중인 라이브는 지원하지 않습니다");
      return;
    }

    const track = selectCaptionTrack(data.tracks, {
      activeVssId: data.activeVssId,
      defaultLanguageCode: data.defaultLanguageCode,
    });
    debug("selected track", {
      tabId,
      languageCode: track?.languageCode,
      kind: track?.kind,
      vssId: track?.vssId,
      hasBaseUrl: track?.baseUrl !== undefined,
    });
    if (track === undefined) {
      await fail(tabId, "이 영상에는 자막이 없습니다");
      return;
    }

    let timedText = await runTimedTextFetch(tabId, track.baseUrl, data, "initial");
    let cues = parseJson3(timedText?.text ?? "");
    debug("parsed cues", { tabId, cueCount: cues.length });
    if (cues.length === 0) {
      debug("prime captions before retry", { tabId });
      const [primeResult] = await browser.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: primeCaptionTrack,
        args: [track],
      });
      debug("prime captions result", { tabId, result: primeResult?.result });

      timedText = await runTimedTextFetch(tabId, track.baseUrl, data, "after-prime");
      cues = parseJson3(timedText?.text ?? "");
      debug("parsed cues after prime", { tabId, cueCount: cues.length });
    }

    if (cues.length === 0) {
      await fail(tabId, "잠시 후 다시 시도하세요");
      return;
    }

    const text = formatTranscript({ title: data.title, url: data.url, cues });
    debug("write clipboard", { tabId, chars: text.length });
    const [copyResult] = await browser.scripting.executeScript({
      target: { tabId },
      func: writeClipboard,
      args: [text],
    });
    if ((copyResult?.result as { ok: boolean } | undefined)?.ok === true) {
      debug("copy success", { tabId });
      await succeed(tabId);
    } else {
      debug("copy failed in page context", { tabId, result: copyResult?.result });
      await fail(tabId, "잠시 후 다시 시도하세요");
    }
  } catch (error) {
    debugError("copy failed", error);
    await fail(tabId, "잠시 후 다시 시도하세요");
  }
}

async function runTimedTextFetch(
  tabId: number,
  baseUrl: string,
  data: RawPlayerData,
  label: string,
): Promise<TimedTextFetchResult | undefined> {
  debug("fetch timedtext", { tabId, label });
  const [fetchResult] = await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: fetchTimedText,
    args: [baseUrl, { potToken: data.potToken, client: data.client }],
  });
  const timedText = fetchResult?.result as TimedTextFetchResult | undefined;
  debug("timedtext result", {
    tabId,
    label,
    ok: timedText?.ok,
    status: timedText?.status,
    statusText: timedText?.statusText,
    contentType: timedText?.contentType,
    bytes: timedText?.bytes,
    url: timedText?.url,
    attempts: timedText?.attempts,
    snippet: timedText?.snippet,
    error: timedText?.error,
  });
  if (timedText?.snippet !== undefined) {
    debug("timedtext snippet", { tabId, label, snippet: timedText.snippet });
  }
  return timedText;
}

async function succeed(tabId: number): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ tabId, color: "#16a34a" });
  await browser.action.setBadgeText({ tabId, text: "✓" });
  await browser.action.setTitle({ tabId, title: "자막이 복사되었습니다" });
  setTimeout(() => {
    void browser.action.setBadgeText({ tabId, text: "" });
    void browser.action.setTitle({ tabId, title: DEFAULT_TITLE });
  }, 1500);
}

async function fail(tabId: number, reason: string): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ tabId, color: "#dc2626" });
  await browser.action.setBadgeText({ tabId, text: "✕" });
  await browser.action.setTitle({ tabId, title: reason });
  setTimeout(() => {
    void browser.action.setBadgeText({ tabId, text: "" });
  }, 2500);
}

async function isCurrentYouTubePageLive(tabId: number): Promise<boolean | undefined> {
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: readIsCurrentLive,
    });
    debug("live probe", { tabId, result: result?.result });
    return result?.result as boolean | undefined;
  } catch (error) {
    debugError("live probe failed", error);
    return undefined;
  }
}

function debug(message: string, details?: unknown): void {
  if (!DEBUG_LOGS) return;
  console.info(`${DEBUG_PREFIX} ${toLogLine(message, details)}`);
}

function debugError(message: string, error: unknown): void {
  if (!DEBUG_LOGS) return;
  console.error(`${DEBUG_PREFIX} ${toLogLine(message, { error: serializeError(error) })}`);
}

function toLogLine(message: string, details?: unknown): string {
  const payload =
    details === undefined
      ? { event: message }
      : isPlainObject(details)
        ? { event: message, ...details }
        : { event: message, value: details };

  return JSON.stringify(payload);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

// ─────────────────────────────────────────────────────────────────────────
// Injected functions. These are serialized and run inside the YouTube page,
// so they MUST stay self-contained: no references to imports or outer scope,
// only their arguments, page globals, and standard web APIs.
// YouTube's player response is private API, so every field read is defensive.
// ─────────────────────────────────────────────────────────────────────────

function readPlayerData(): RawPlayerData | null {
  const win = window as any;
  const player = document.getElementById("movie_player") as any;
  const response = player?.getPlayerResponse?.() ?? win.ytInitialPlayerResponse;
  if (response == null) return null;

  const tracklist = response.captions?.playerCaptionsTracklistRenderer;
  const rawTracks: any[] = tracklist?.captionTracks ?? [];
  const tracks: CaptionTrack[] = rawTracks
    .map((track: any): CaptionTrack | null => {
      if (typeof track.baseUrl !== "string" || typeof track.languageCode !== "string") {
        return null;
      }

      return {
        baseUrl: track.baseUrl,
        languageCode: track.languageCode,
        kind: typeof track.kind === "string" ? track.kind : undefined,
        vssId: typeof track.vssId === "string" ? track.vssId : undefined,
        name: track.name?.simpleText ?? track.name?.runs?.[0]?.text,
      };
    })
    .filter((track: CaptionTrack | null): track is CaptionTrack => track !== null);

  let activeVssId: string | undefined;
  try {
    activeVssId = player?.getOption?.("captions", "track")?.vssId ?? undefined;
  } catch {
    activeVssId = undefined;
  }

  const videoId: string | undefined = response.videoDetails?.videoId;
  return {
    isLive: isCurrentlyLive(response),
    title: response.videoDetails?.title ?? document.title,
    url: videoId === undefined ? location.href : `https://www.youtube.com/watch?v=${videoId}`,
    defaultLanguageCode: getDefaultLanguageCode(tracklist, rawTracks),
    activeVssId,
    potToken: findPotToken(response),
    client: getClientHints(),
    tracks,
  };

  function findPotToken(response: any): string | undefined {
    for (const format of [
      ...(response.streamingData?.formats ?? []),
      ...(response.streamingData?.adaptiveFormats ?? []),
    ]) {
      const pot = getPotFromFormat(format);
      if (pot !== undefined) return pot;
    }

    for (const entry of performance.getEntriesByType("resource")) {
      const pot = getPotFromUrl((entry as PerformanceResourceTiming).name);
      if (pot !== undefined) return pot;
    }

    return undefined;
  }

  function getPotFromFormat(format: any): string | undefined {
    if (typeof format?.url === "string") return getPotFromUrl(format.url);
    if (typeof format?.signatureCipher === "string")
      return getPotFromCipher(format.signatureCipher);
    if (typeof format?.cipher === "string") return getPotFromCipher(format.cipher);
    return undefined;
  }

  function getPotFromCipher(cipher: string): string | undefined {
    try {
      const url = new URLSearchParams(cipher).get("url");
      return url === null ? undefined : getPotFromUrl(url);
    } catch {
      return undefined;
    }
  }

  function getPotFromUrl(rawUrl: string): string | undefined {
    try {
      const parsed = new URL(rawUrl);
      return parsed.searchParams.get("pot") ?? undefined;
    } catch {
      return undefined;
    }
  }

  function getClientHints(): TimedTextClientHints {
    const ytcfg = win.ytcfg;
    const client = ytcfg?.get?.("INNERTUBE_CONTEXT")?.client ?? {};
    return {
      clientVersion:
        ytcfg?.get?.("INNERTUBE_CONTEXT_CLIENT_VERSION") ?? client.clientVersion ?? undefined,
      browserName: client.browserName ?? undefined,
      browserVersion: client.browserVersion ?? undefined,
      osName: client.osName ?? undefined,
      osVersion: client.osVersion ?? undefined,
    };
  }

  function getDefaultLanguageCode(tracklist: any, rawTracks: any[]): string | undefined {
    const audioTracks: any[] = Array.isArray(tracklist?.audioTracks) ? tracklist.audioTracks : [];
    const defaultAudioIndex = asValidIndex(tracklist?.defaultAudioTrackIndex, audioTracks) ?? 0;
    const defaultAudioTrack = audioTracks.length === 0 ? undefined : audioTracks[defaultAudioIndex];
    const defaultCaptionIndex = asValidIndex(
      defaultAudioTrack?.defaultCaptionTrackIndex,
      rawTracks,
    );
    if (defaultCaptionIndex !== undefined) return rawTracks[defaultCaptionIndex]?.languageCode;

    const captionTrackIndices: unknown = defaultAudioTrack?.captionTrackIndices;
    if (Array.isArray(captionTrackIndices)) {
      for (const index of captionTrackIndices) {
        const validIndex = asValidIndex(index, rawTracks);
        if (validIndex !== undefined) return rawTracks[validIndex]?.languageCode;
      }
    }

    return rawTracks[0]?.languageCode;
  }

  function asValidIndex(value: unknown, items: unknown[]): number | undefined {
    return typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < items.length
      ? value
      : undefined;
  }

  function isCurrentlyLive(response: any): boolean {
    return (
      response.videoDetails?.isLive === true ||
      response.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true ||
      response.playabilityStatus?.liveStreamability !== undefined
    );
  }
}

function readIsCurrentLive(): boolean | undefined {
  const win = window as any;
  const player = document.getElementById("movie_player") as any;
  const response = player?.getPlayerResponse?.() ?? win.ytInitialPlayerResponse;
  if (response == null) return undefined;

  return (
    response.videoDetails?.isLive === true ||
    response.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true ||
    response.playabilityStatus?.liveStreamability !== undefined
  );
}

async function primeCaptionTrack(track: CaptionTrack): Promise<CaptionPrimeResult> {
  const methods: string[] = [];
  try {
    const player = document.getElementById("movie_player") as any;
    if (player == null) {
      return {
        ok: false,
        methods,
        beforeTrack: undefined,
        afterTrack: undefined,
        beforeButtonPressed: undefined,
        afterButtonPressed: undefined,
        timedTextResourceCount: 0,
        latestTimedTextUrl: undefined,
        error: "movie_player not found",
      };
    }

    const startedAt = performance.now();
    const beforeTrack = getActiveTrack(player);
    const beforeButtonPressed = getCaptionButtonPressed();
    const selectedTrack = toPlayerCaptionTrack(track);

    if (typeof player.loadModule === "function") {
      player.loadModule("captions");
      methods.push("loadModule(captions)");
    }

    if (typeof player.setOption === "function") {
      player.setOption("captions", "track", selectedTrack);
      methods.push("setOption(captions.track)");
    }

    await waitForTimedTextResource(startedAt, 1500);

    let timedTextResources = getTimedTextResources(startedAt);
    if (timedTextResources.length === 0) {
      const button = document.querySelector<HTMLButtonElement>(".ytp-subtitles-button");
      if (button !== null) {
        const pressedBeforeClick = getCaptionButtonPressed();
        if (pressedBeforeClick === true) {
          button.click();
          methods.push("click(.ytp-subtitles-button off)");
          await wait(250);
          button.click();
          methods.push("click(.ytp-subtitles-button on)");
        } else {
          button.click();
          methods.push("click(.ytp-subtitles-button on)");
        }
        await waitForTimedTextResource(startedAt, 3000);
        timedTextResources = getTimedTextResources(startedAt);
      }
    }

    return {
      ok: methods.length > 0,
      methods,
      beforeTrack,
      afterTrack: getActiveTrack(player),
      beforeButtonPressed,
      afterButtonPressed: getCaptionButtonPressed(),
      timedTextResourceCount: timedTextResources.length,
      latestTimedTextUrl: timedTextResources[0]?.url,
    };
  } catch (error) {
    return {
      ok: false,
      methods,
      beforeTrack: undefined,
      afterTrack: undefined,
      beforeButtonPressed: undefined,
      afterButtonPressed: undefined,
      timedTextResourceCount: 0,
      latestTimedTextUrl: undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  function toPlayerCaptionTrack(track: CaptionTrack): Record<string, string> {
    const result: Record<string, string> = { languageCode: track.languageCode };
    if (track.kind !== undefined) result.kind = track.kind;
    if (track.vssId !== undefined) result.vssId = track.vssId;
    if (track.name !== undefined) result.name = track.name;
    return result;
  }

  function getActiveTrack(player: any): string | undefined {
    try {
      const active = player?.getOption?.("captions", "track");
      return active?.vssId ?? active?.languageCode ?? undefined;
    } catch {
      return undefined;
    }
  }

  function getCaptionButtonPressed(): boolean | undefined {
    const value = document
      .querySelector<HTMLButtonElement>(".ytp-subtitles-button")
      ?.getAttribute("aria-pressed");
    return value === null || value === undefined ? undefined : value === "true";
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForTimedTextResource(startedAt: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (getTimedTextResources(startedAt).length > 0) return;
      await wait(100);
    }
  }

  function getTimedTextResources(
    startedAt: number,
  ): Array<{ startTime: number; url: TimedTextUrlDebug }> {
    const urls: Array<{ startTime: number; url: TimedTextUrlDebug }> = [];
    for (const entry of performance.getEntriesByType("resource")) {
      if (entry.startTime < startedAt) continue;

      try {
        const url = new URL((entry as PerformanceResourceTiming).name);
        if (url.pathname !== "/api/timedtext") continue;
        urls.push({
          startTime: entry.startTime,
          url: toTimedTextUrlDebug(url, url.searchParams.get("fmt")),
        });
      } catch {
        // ignore non-URL resources
      }
    }
    return urls.sort((a, b) => b.startTime - a.startTime);
  }

  function toTimedTextUrlDebug(url: URL, originalFmt: string | null): TimedTextUrlDebug {
    return {
      host: url.hostname,
      pathname: url.pathname,
      originalFmt,
      fmt: url.searchParams.get("fmt"),
      lang: url.searchParams.get("lang"),
      kind: url.searchParams.get("kind"),
      hasPot: url.searchParams.has("pot") || url.searchParams.has("potc"),
      hasSignature: url.searchParams.has("sig") || url.searchParams.has("signature"),
      paramNames: Array.from(url.searchParams.keys()),
    };
  }
}

async function fetchTimedText(
  baseUrl: string,
  hints: { potToken?: string | undefined; client?: TimedTextClientHints | undefined },
): Promise<TimedTextFetchResult> {
  const url = new URL(baseUrl);
  const originalFmt = url.searchParams.get("fmt");
  url.searchParams.delete("fmt");
  url.searchParams.set("fmt", "json3");

  const attempts: Array<TimedTextFetchAttempt & { text: string }> = [];
  const plainAttempt = await fetchTimedTextUrl("plain", url, originalFmt);
  attempts.push(plainAttempt);
  if (isJson3Response(plainAttempt)) return toResult(plainAttempt, attempts);

  if (hints.potToken !== undefined) {
    const potUrl = new URL(url.toString());
    potUrl.searchParams.set("potc", "1");
    potUrl.searchParams.set("pot", hints.potToken);
    if (!potUrl.searchParams.has("c")) potUrl.searchParams.set("c", "WEB");
    if (hints.client?.clientVersion !== undefined && !potUrl.searchParams.has("cver")) {
      potUrl.searchParams.set("cver", hints.client.clientVersion);
    }
    if (hints.client?.browserName !== undefined && !potUrl.searchParams.has("cbr")) {
      potUrl.searchParams.set("cbr", hints.client.browserName);
    }
    if (hints.client?.browserVersion !== undefined && !potUrl.searchParams.has("cbrver")) {
      potUrl.searchParams.set("cbrver", hints.client.browserVersion);
    }
    if (hints.client?.osName !== undefined && !potUrl.searchParams.has("cos")) {
      potUrl.searchParams.set("cos", hints.client.osName);
    }
    if (hints.client?.osVersion !== undefined && !potUrl.searchParams.has("cosver")) {
      potUrl.searchParams.set("cosver", hints.client.osVersion);
    }
    if (!potUrl.searchParams.has("cplayer")) potUrl.searchParams.set("cplayer", "UNIPLAYER");
    if (!potUrl.searchParams.has("cplatform")) potUrl.searchParams.set("cplatform", "DESKTOP");

    const potAttempt = await fetchTimedTextUrl("pot", potUrl, originalFmt);
    attempts.push(potAttempt);
    if (isJson3Response(potAttempt)) return toResult(potAttempt, attempts);
  }

  for (const resourceUrl of getTimedTextResourceCandidates(url)) {
    const resourceAttempt = await fetchTimedTextUrl(
      "resource",
      resourceUrl,
      resourceUrl.searchParams.get("fmt"),
    );
    attempts.push(resourceAttempt);
    if (isJson3Response(resourceAttempt)) return toResult(resourceAttempt, attempts);
  }

  const bestAttempt =
    attempts.find((attempt) => attempt.bytes > 0) ?? attempts[attempts.length - 1];
  return toResult(bestAttempt, attempts, "");

  async function fetchTimedTextUrl(
    label: string,
    requestUrl: URL,
    originalFmt: string | null,
  ): Promise<TimedTextFetchAttempt & { text: string }> {
    const urlDebug = toUrlDebug(requestUrl, originalFmt);
    try {
      const response = await fetch(requestUrl.toString(), { credentials: "include" });
      const text = await response.text();
      return {
        label,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
        bytes: text.length,
        text,
        snippet: text.slice(0, 300),
        url: urlDebug,
      };
    } catch (error) {
      return {
        label,
        ok: false,
        status: 0,
        statusText: "",
        contentType: null,
        bytes: 0,
        text: "",
        snippet: "",
        url: urlDebug,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  function toUrlDebug(requestUrl: URL, originalFmt: string | null): TimedTextUrlDebug {
    return {
      host: requestUrl.hostname,
      pathname: requestUrl.pathname,
      originalFmt,
      fmt: requestUrl.searchParams.get("fmt"),
      lang: requestUrl.searchParams.get("lang"),
      kind: requestUrl.searchParams.get("kind"),
      hasPot: requestUrl.searchParams.has("pot") || requestUrl.searchParams.has("potc"),
      hasSignature: requestUrl.searchParams.has("sig") || requestUrl.searchParams.has("signature"),
      paramNames: Array.from(requestUrl.searchParams.keys()),
    };
  }

  function getTimedTextResourceCandidates(baseUrl: URL): URL[] {
    const candidates: Array<{ startTime: number; url: URL }> = [];
    const videoId = baseUrl.searchParams.get("v");
    const language = baseUrl.searchParams.get("lang");
    const kind = baseUrl.searchParams.get("kind");

    for (const entry of performance.getEntriesByType("resource")) {
      try {
        const candidate = new URL((entry as PerformanceResourceTiming).name);
        if (candidate.pathname !== "/api/timedtext") continue;
        if (videoId !== null && candidate.searchParams.get("v") !== videoId) continue;
        if (language !== null && candidate.searchParams.get("lang") !== language) continue;
        if (kind !== null && candidate.searchParams.get("kind") !== kind) continue;

        candidate.searchParams.delete("fmt");
        candidate.searchParams.set("fmt", "json3");
        candidates.push({ startTime: entry.startTime, url: candidate });
      } catch {
        // ignore non-URL resources
      }
    }

    const seen = new Set<string>();
    return candidates
      .sort((a, b) => b.startTime - a.startTime)
      .map((candidate) => candidate.url)
      .filter((candidate) => {
        const key = candidate.toString();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function isJson3Response(attempt: TimedTextFetchAttempt & { text: string }): boolean {
    const trimmed = attempt.text.trimStart();
    return attempt.ok && trimmed.startsWith("{") && trimmed.includes('"events"');
  }

  function toResult(
    attempt: TimedTextFetchAttempt & { text: string },
    attempts: Array<TimedTextFetchAttempt & { text: string }>,
    text = attempt.text,
  ): TimedTextFetchResult {
    return {
      ok: attempt.ok,
      status: attempt.status,
      statusText: attempt.statusText,
      contentType: attempt.contentType,
      bytes: attempt.bytes,
      text,
      snippet: attempt.snippet,
      url: attempt.url,
      attempts: attempts.map(({ text: _text, ...attempt }) => attempt),
      error: attempt.error,
    };
  }
}

async function writeClipboard(text: string): Promise<{ ok: boolean }> {
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
