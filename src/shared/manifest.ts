/**
 * The Manifest V3 definition, authored in TypeScript so the product name and
 * version come from one place and the permission list can carry its reasoning.
 *
 * Every permission here is required for V1 to function. Notably absent, and
 * deliberately so: `history`, `bookmarks`, `cookies`, `webRequest`,
 * `scripting`, and any host permission. TimeScope reads a tab's URL to derive
 * a domain and nothing else - it never injects a content script, never reads
 * page content, and makes no network requests of any kind.
 */
import { BRANDING } from './branding.js';

export function buildManifest(version: string): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: BRANDING.name,
    short_name: BRANDING.shortName,
    version,
    description: BRANDING.description,

    permissions: [
      // Read the active tab's URL to derive its domain. Without this,
      // `tabs.query` returns no URL and there is nothing to track.
      'tabs',
      // Persist settings and daily records locally.
      'storage',
      // The one-minute heartbeat and the midnight rollover. Alarms survive
      // service-worker suspension; `setInterval` does not.
      'alarms',
      // Detect that the user has stepped away, so an untouched tab does not
      // accrue hours of phantom time.
      'idle',
      // Render site favicons from the browser's own local cache
      // (chrome-extension://<id>/_favicon/). This is what makes it possible
      // to show an icon WITHOUT calling a third-party favicon service.
      'favicon',
    ],

    background: {
      service_worker: 'background.js',
      type: 'module',
    },

    action: {
      default_popup: 'popup.html',
      default_title: BRANDING.name,
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
      },
    },

    options_page: 'dashboard.html#/settings',

    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },

    // No remote code, ever. This is the default for MV3 but stating it
    // explicitly documents the intent and fails loudly if something regresses.
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
  } as chrome.runtime.ManifestV3;
}
