import { defineConfig } from "wxt";

const ICONS = {
  "16": "icon/16.png",
  "24": "icon/24.png",
  "32": "icon/32.png",
  "48": "icon/48.png",
  "64": "icon/64.png",
  "96": "icon/96.png",
  "128": "icon/128.png",
};
const EXTENSION_NAME = "Just Copy Subtitles for YouTube";

// https://wxt.dev/api/config.html
export default defineConfig({
  // Both browsers ship Manifest V3 (WXT defaults Firefox to MV2 otherwise).
  manifestVersion: 3,
  // Cleaner store/release artifact names, e.g. just-copy-subtitles-for-youtube-0.1.0-chrome.zip
  zip: {
    name: "just-copy-subtitles-for-youtube",
  },
  manifest: ({ browser }) => ({
    name: EXTENSION_NAME,
    description:
      "Copy the full transcript of the current YouTube video to your clipboard with one click.",
    homepage_url: "https://github.com/BitYoungjae/just-copy-subtitles-for-youtube",
    icons: ICONS,
    permissions: ["scripting", "clipboardWrite"],
    host_permissions: ["*://*.youtube.com/*"],
    action: {
      default_icon: ICONS,
      default_title: EXTENSION_NAME,
    },
    // Firefox requires a stable extension id for signing and distribution.
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "just-copy-youtube-subtitles@bgpworks.com",
              data_collection_permissions: { required: ["none"] },
            },
          },
        }
      : {}),
  }),
});
