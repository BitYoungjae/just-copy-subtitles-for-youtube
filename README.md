<div align="center">

<img src="./icon.png" width="120" alt="Just Copy Subtitles for YouTube logo" />

# Just Copy Subtitles for YouTube

**Click the toolbar icon. The full transcript of the video you're watching lands on your clipboard.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/just-copy-subtitles-for-y/ffeoaadmmdmnjmlilhnncnhgfkdbanoj)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox%20Add--ons-install-FF7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/just-copy-subtitles-youtube/)
![Tracking: none](https://img.shields.io/badge/tracking-none-success)

</div>

---

You're watching a YouTube video and you want the words. Click the icon. The whole transcript sits on your clipboard, with timestamps and a link back to the video. Paste it into ChatGPT, Claude, Notion, a text file, or wherever the text needs to go.

## No UI. No AI.

The whole extension is one toolbar button and a small badge that confirms the copy. There's no popup, no options page, no account, no format picker.

It copies. It never summarizes, translates, or rewrites, and it never sends your data anywhere. You get the raw transcript and decide what to do with it.

## What you get

Paste, and the text reads like this: the video title, its link, a blank line, then one line per caption.

```text
Intro to React - Component Basics
https://www.youtube.com/watch?v=abc123

0:00  Hey everyone
0:03  Today we're talking about React
0:07  [Music]
0:10  Let's start with what a component is
```

Timestamps use `0:07` and `12:34` under an hour, `1:02:05` past it. Bracket cues like `[Music]` stay in. Long videos copy in full.

## Install

### From the stores

**[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/just-copy-subtitles-for-y/ffeoaadmmdmnjmlilhnncnhgfkdbanoj)** — works in Chrome and other Chromium browsers (Edge, Brave, Arc).

**[Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/just-copy-subtitles-youtube/)** — works in Firefox.

### From source

```sh
bun install
bun run build          # Chrome   -> apps/extension/.output/chrome-mv3
bun run build:firefox  # Firefox  -> apps/extension/.output/firefox-mv3
```

Then load the build:

- **Chrome**: open `chrome://extensions`, turn on Developer mode, click _Load unpacked_, and pick `apps/extension/.output/chrome-mv3`.
- **Firefox**: open `about:debugging#/runtime/this-firefox`, click _Load Temporary Add-on_, and pick any file inside `apps/extension/.output/firefox-mv3`.

Pin the icon to your toolbar and you're set.

## Privacy

Everything runs in your browser. The extension reads the caption data YouTube already loaded on the page, formats it, and writes it to your clipboard. No external server, no analytics, no remote config.

It asks for two permissions: read access to `youtube.com` pages (to find the captions) and clipboard write (to drop the result). Full details in [`PRIVACY.md`](./PRIVACY.md).

## Where it works

The icon lights up on regular videos (`/watch`) and Shorts (`/shorts`), finished live streams included. It stays dark everywhere else, and on live streams or premieres still in progress, since the transcript isn't final yet.

When a video has no captions, the badge shows `✕` and the tooltip says so. Nothing copies.

## Development

```sh
bun install            # install deps (postinstall runs wxt prepare)

bun run dev            # Chrome dev mode with HMR
bun run dev:firefox    # Firefox dev mode

bun test               # core unit tests
bun run check          # type-check (tsgo)
bun run lint           # oxlint
bun run format         # oxfmt
```

### Layout

```text
packages/core   pure logic (parsing, track selection, formatting), no browser APIs, tested with bun test
apps/extension  the WXT extension (Chrome + Firefox)
```

The product contract lives in [`SPEC.md`](./SPEC.md). The runtime design lives in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

Toolchain: bun (package manager, test runner), WXT + Vite (bundling), tsgo (type-check), oxlint (lint), oxfmt (format).

## License

MIT © [BitYoungjae](https://github.com/BitYoungjae). See [LICENSE](./LICENSE).

## Trademark

YouTube is a trademark of Google LLC. This extension is not affiliated with, sponsored by, or endorsed by Google or YouTube.
