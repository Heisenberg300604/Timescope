/**
 * A narrow port over `chrome.storage.local`.
 *
 * Everything above this file talks to `StorageArea`, never to `chrome.*`
 * directly. That keeps the repository unit-testable with an in-memory fake and
 * leaves a single seam to swap in IndexedDB if the dataset ever outgrows
 * `storage.local`.
 */

export interface StorageArea {
  get(keys: string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
  clear(): Promise<void>;
}

/** The real extension storage area. */
export const chromeStorageArea: StorageArea = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
  remove: (keys) => chrome.storage.local.remove(keys),
  clear: () => chrome.storage.local.clear(),
};

/** In-memory implementation used by tests and as a fallback if storage fails. */
export function createMemoryStorageArea(
  initial: Record<string, unknown> = {},
): StorageArea & { snapshot(): Record<string, unknown> } {
  let data: Record<string, unknown> = structuredClone(initial);
  return {
    async get(keys) {
      if (keys === null) return structuredClone(data);
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        if (key in data) out[key] = structuredClone(data[key]);
      }
      return out;
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) data[key] = structuredClone(value);
    },
    async remove(keys) {
      for (const key of keys) delete data[key];
    },
    async clear() {
      data = {};
    },
    snapshot: () => structuredClone(data),
  };
}
