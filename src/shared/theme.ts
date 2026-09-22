/**
 * Applies the theme preference to the document.
 *
 * `system` removes the attribute entirely, letting the `prefers-color-scheme`
 * block in theme.css take over - so the OS switching at dusk is picked up live,
 * with no listener and no re-render.
 */
import type { ThemePreference } from '../types';

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

/**
 * Paint the stored theme before React mounts, so a dark-mode user never sees a
 * white flash. Reads storage directly because the repository is async and this
 * needs to run as early as possible.
 */
export function applyStoredThemeEarly(): void {
  try {
    chrome.storage.local.get(['settings'], (stored) => {
      const theme = (stored?.settings as { theme?: ThemePreference } | undefined)?.theme;
      if (theme) applyTheme(theme);
    });
  } catch {
    // Storage unavailable: the CSS media query still gives a sensible default.
  }
}
