/**
 * Favicons, without a third-party request.
 *
 * Chrome exposes its OWN favicon cache to extensions holding the `favicon`
 * permission at `chrome-extension://<id>/_favicon/?pageUrl=...`. That means an
 * icon is only ever shown for a site the browser already visited, the image
 * never leaves the machine, and no favicon-proxy service (which would see the
 * user's entire browsing list) is involved.
 *
 * When the cache has no entry, `<Favicon>` falls back to a generated monogram.
 */

export function faviconUrl(domain: string, size = 32): string | null {
  try {
    const url = new URL(chrome.runtime.getURL('/_favicon/'));
    // The API wants a page URL; the origin is enough and keeps paths out of it.
    url.searchParams.set('pageUrl', `https://${domain}`);
    url.searchParams.set('size', String(size));
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Deterministic fallback tint for a domain's monogram tile.
 * Hashing the domain keeps a site's tile stable between sessions.
 */
export function monogramSlot(domain: string, slots: number): number {
  let hash = 0;
  for (let i = 0; i < domain.length; i += 1) {
    hash = (hash * 31 + domain.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % slots;
}
