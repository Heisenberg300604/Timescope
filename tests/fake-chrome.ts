/**
 * A minimal in-memory `chrome` API, covering exactly the surface the tracker
 * touches. Lets the worker's behaviour be tested without a real browser.
 */
import { vi } from 'vitest';

export interface FakeTab {
  id: number;
  windowId: number;
  active: boolean;
  url?: string;
}

export function createFakeChrome() {
  const state = {
    tabs: [] as FakeTab[],
    /** Window id holding OS focus, or null when the browser is in the background. */
    focusedWindowId: null as number | null,
    idleState: 'active' as chrome.idle.IdleState,
    idleDetectionInterval: 60,
    alarms: new Map<string, { when?: number; periodInMinutes?: number }>(),
  };

  const api = {
    tabs: {
      query: vi.fn(async (q: { active?: boolean; lastFocusedWindow?: boolean }) => {
        // The fake models `lastFocusedWindow` as the focused window, falling
        // back to the first window when the browser is backgrounded - which is
        // what Chrome does.
        const windowId = state.focusedWindowId ?? state.tabs[0]?.windowId;
        return state.tabs.filter(
          (t) => (!q.active || t.active) && (!q.lastFocusedWindow || t.windowId === windowId),
        );
      }),
    },
    windows: {
      get: vi.fn(async (windowId: number) => {
        const exists = state.tabs.some((t) => t.windowId === windowId);
        if (!exists) throw new Error('No window with id');
        return { id: windowId, focused: state.focusedWindowId === windowId };
      }),
    },
    idle: {
      setDetectionInterval: vi.fn((seconds: number) => {
        state.idleDetectionInterval = seconds;
      }),
      queryState: vi.fn(async () => state.idleState),
    },
    alarms: {
      create: vi.fn((name: string, info: { when?: number; periodInMinutes?: number }) => {
        state.alarms.set(name, info);
      }),
      clear: vi.fn(async (name: string) => state.alarms.delete(name)),
    },
    storage: {
      local: { getBytesInUse: vi.fn(async () => 0) },
    },
  };

  /** Helpers that read like user actions in the tests. */
  const actions = {
    openTab(url: string, { windowId = 1, id = state.tabs.length + 1 } = {}) {
      for (const t of state.tabs) if (t.windowId === windowId) t.active = false;
      state.tabs.push({ id, windowId, active: true, url });
      state.focusedWindowId ??= windowId;
      return id;
    },
    switchToTab(id: number) {
      const target = state.tabs.find((t) => t.id === id);
      if (!target) throw new Error(`no tab ${id}`);
      for (const t of state.tabs) if (t.windowId === target.windowId) t.active = false;
      target.active = true;
      state.focusedWindowId = target.windowId;
    },
    navigate(id: number, url: string) {
      const tab = state.tabs.find((t) => t.id === id);
      if (tab) tab.url = url;
    },
    blurBrowser() {
      state.focusedWindowId = null;
    },
    focusWindow(windowId = 1) {
      state.focusedWindowId = windowId;
    },
    closeAllTabs() {
      state.tabs = [];
      state.focusedWindowId = null;
    },
    setIdle(idleState: chrome.idle.IdleState) {
      state.idleState = idleState;
    },
  };

  return { api, state, actions };
}

/** Install the fake as the global `chrome` for the duration of a test file. */
export function installFakeChrome() {
  const fake = createFakeChrome();
  (globalThis as unknown as { chrome: unknown }).chrome = fake.api;
  return fake;
}
