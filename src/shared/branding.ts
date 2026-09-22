/**
 * Single source of truth for the product name.
 *
 * The manifest is generated from these values at build time and every UI
 * surface imports them, so renaming the extension is a one-line change here.
 */
export const BRANDING = {
  name: 'TimeScope',
  /** Shown under the icon in the browser's extension list. */
  shortName: 'TimeScope',
  description: 'See where your browser time goes. Everything stays on your device.',
  tagline: 'Browser time, measured locally.',
} as const;
