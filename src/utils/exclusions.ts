/**
 * Domain exclusion matching.
 *
 * A pattern matches a domain when it is equal to it, or when the domain is a
 * subdomain of it (`example.com` excludes `app.example.com`). A bare `localhost`
 * pattern also excludes every port (`localhost:3000`), since a developer
 * silencing localhost means all of it.
 *
 * Patterns are normalized on entry so a user can paste `https://example.com/`
 * and get what they expect.
 */

/** Reduce user input to a bare host, or `null` if nothing usable remains. */
export function normalizeExclusionPattern(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Accept a full URL, a bare host, or a host:port.
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const host = withoutScheme.split('/')[0].replace(/^www\./, '');
  if (!host) return null;

  // Reject anything that is clearly not a host.
  if (/\s/.test(host)) return null;
  return host;
}

export function isExcluded(domain: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const hostOnly = domain.split(':')[0];

  return patterns.some((pattern) => {
    if (pattern === domain) return true;
    // A port-less pattern covers every port on that host.
    if (!pattern.includes(':') && pattern === hostOnly) return true;
    // Subdomain match, guarding against `notexample.com` matching `example.com`.
    return domain.endsWith(`.${pattern}`);
  });
}
