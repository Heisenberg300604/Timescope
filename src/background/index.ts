/**
 * Service-worker entry point.
 *
 * This file does one thing: translate `chrome.*` events into `Tracker` calls.
 * All listeners are registered SYNCHRONOUSLY at the top level, which is what
 * lets Chrome wake a suspended worker to deliver an event - a listener
 * registered inside an async callback would be missed.
 *
 * `tracker.start()` is idempotent and every handler awaits it, so an event that
 * revives the worker is handled correctly even though the worker has only just
 * begun initializing.
 */

import { TrackingRepository } from '../storage/repository';
import { ALARM_HEARTBEAT, ALARM_MIDNIGHT, Tracker } from './tracker';
import { KEYS } from '../storage/schema';
import type { RuntimeRequest } from '../types';

const repository = new TrackingRepository();
const tracker = new Tracker(repository);

/** Every handler funnels through here so start-up races cannot lose an event. */
const ready = (async () => {
  try {
    await tracker.start();
  } catch (error) {
    console.error('[TimeScope] failed to start tracker', error);
  }
})();

const handle = (work: () => Promise<unknown>): void => {
  void ready.then(work).catch((error) => {
    console.error('[TimeScope] event handler failed', error);
  });
};

// -- installation and browser start -----------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  handle(async () => {
    if (details.reason === 'install') {
      // Open the dashboard once so a first-time user sees what this is.
      await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    }
    await tracker.reconcile();
  });
});

chrome.runtime.onStartup.addListener(() => {
  handle(() => tracker.reconcile());
});

// -- tab and window events ---------------------------------------------------

chrome.tabs.onActivated.addListener(() => {
  handle(() => tracker.reconcile());
});

/**
 * Fires for every stage of every tab's load. We only care about the URL
 * settling on the tab the user is looking at - filtering here keeps a
 * background page loading a hundred subresources from waking the tracker.
 *
 * `changeInfo.url` also covers SPA navigation (`history.pushState`), which is
 * why no `webNavigation` permission is needed.
 */
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  if (!tab.active) return;
  handle(() => tracker.reconcile());
});

chrome.tabs.onRemoved.addListener(() => {
  handle(() => tracker.reconcile());
});

/**
 * Covers focusing another window, minimizing, and switching to another
 * application - Chrome reports `WINDOW_ID_NONE` for all three.
 */
chrome.windows.onFocusChanged.addListener(() => {
  handle(() => tracker.reconcile());
});

// -- idle --------------------------------------------------------------------

chrome.idle.onStateChanged.addListener((state) => {
  handle(() => tracker.onIdleStateChanged(state));
});

// -- alarms ------------------------------------------------------------------

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_HEARTBEAT) handle(() => tracker.onHeartbeat());
  else if (alarm.name === ALARM_MIDNIGHT) handle(() => tracker.onMidnight());
});

// -- settings changes from other surfaces ------------------------------------

/**
 * The dashboard and popup write settings directly through the repository.
 * Listening for the storage change is more reliable than asking them to send a
 * message, because it also catches a settings write made while the worker was
 * asleep.
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[KEYS.settings]) return;
  handle(() => tracker.onSettingsChanged());
});

// -- messages from the popup -------------------------------------------------

chrome.runtime.onMessage.addListener((request: RuntimeRequest, _sender, sendResponse) => {
  if (request?.type === 'get-live-status') {
    ready
      .then(() => tracker.getLiveStatus())
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: 'unavailable' }));
    return true; // Keep the message channel open for the async reply.
  }
  if (request?.type === 'flush') {
    ready
      .then(() => tracker.persistNow())
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false, error: 'unavailable' }));
    return true;
  }
  return false;
});

/**
 * Chrome gives roughly a second of notice before suspending the worker. Flush
 * the snapshot so recovery has the freshest possible high-water mark.
 */
chrome.runtime.onSuspend.addListener(() => {
  void tracker.persistNow();
});
