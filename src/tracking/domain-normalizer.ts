/**
 * The single place where a URL becomes a tracked identity.
 *
 * Policy (V1):
 *  - Only `http:` and `https:` are tracked. Browser-internal pages
 *    (`chrome://`, `brave://`, `edge://`, `about:`, `file://`, extension pages,
 *    `devtools://`, `view-source:`) are untrackable and produce `null`.
 *  - Cosmetic host prefixes (`www.`, `m.`, `mobile.`, `amp.`) are stripped so
 *    `www.youtube.com` and `m.youtube.com` collapse into `youtube.com`.
 *  - Meaningful subdomains are PRESERVED. `gemini.google.com` is a different
 *    product from `docs.google.com`, and collapsing to an eTLD+1 would need a
 *    bundled Public Suffix List for a result most users would find worse.
 *  - Loopback hosts KEEP their port: `localhost:3000` and `localhost:5173` are
 *    usually unrelated projects, so merging them would make analytics
 *    misleading. Non-loopback hosts drop the port.
 *  - Paths, query strings and fragments are discarded and never stored.
 */

/** Schemes that carry real browsing activity. Everything else is ignored. */
const TRACKABLE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Host prefixes that denote the same site rather than a distinct property.
 * Deliberately short: anything ambiguous is left alone.
 */
const COSMETIC_PREFIXES = ['www.', 'm.', 'mobile.', 'amp.'];

/** Hosts where the port distinguishes unrelated local applications. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

/**
 * Reduce a URL to the domain key used for all storage and analytics.
 *
 * @returns the normalized domain, or `null` when the URL should not be tracked.
 */
export function normalizeUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    // Malformed or relative URL - never throw into the tracker's event path.
    return null;
  }

  if (!TRACKABLE_PROTOCOLS.has(url.protocol)) return null;

  const hostname = url.hostname.toLowerCase();
  if (!hostname) return null;

  if (LOOPBACK_HOSTS.has(hostname)) {
    // Keep the port so two dev servers stay separate entries.
    return url.port ? `${hostname}:${url.port}` : hostname;
  }

  return stripCosmeticPrefix(hostname);
}

/**
 * Remove one leading cosmetic prefix, but never reduce a host to a bare
 * public suffix (`m.co` must stay `m.co`, not become `co`).
 */
function stripCosmeticPrefix(hostname: string): string {
  for (const prefix of COSMETIC_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      const stripped = hostname.slice(prefix.length);
      if (stripped.includes('.')) return stripped;
    }
  }
  return hostname;
}

/**
 * Fallback display label for a domain: the leftmost meaningful label, capitalized.
 * `gemini.google.com` -> `Gemini`, `youtube.com` -> `Youtube`.
 *
 * Known brands get correct casing from the site catalog (`categories/catalog.ts`);
 * this is only the fallback for sites we have never seen.
 */
export function fallbackDisplayName(domain: string): string {
  const primary = domain.split(':')[0].split('.')[0];
  if (!primary) return domain;
  return primary.charAt(0).toUpperCase() + primary.slice(1);
}
