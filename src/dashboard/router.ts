/**
 * A hash router in thirty lines.
 *
 * The dashboard has four destinations plus a detail view. Pulling in a routing
 * library for that would be more code to read, not less, and hash routing is
 * what an extension page needs anyway - `options_page` can deep-link to
 * `dashboard.html#/settings` with no server rewrites involved.
 */
import { useCallback, useEffect, useState } from 'react';

export type Route =
  | { name: 'overview' }
  | { name: 'websites' }
  | { name: 'website'; domain: string }
  | { name: 'sessions' }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, tail] = path.split('/');

  switch (head) {
    case 'websites':
      // The domain is encoded because it can contain a port (`localhost:3000`).
      return tail ? { name: 'website', domain: decodeURIComponent(tail) } : { name: 'websites' };
    case 'sessions':
      return { name: 'sessions' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'overview' };
  }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'websites':
      return '#/websites';
    case 'website':
      return `#/websites/${encodeURIComponent(route.domain)}`;
    case 'sessions':
      return '#/sessions';
    case 'settings':
      return '#/settings';
    default:
      return '#/';
  }
}

export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.location.hash = hrefFor(next);
  }, []);

  return [route, navigate];
}
