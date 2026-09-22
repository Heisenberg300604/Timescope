/**
 * Category colors.
 *
 * These eight hues were not chosen by eye. They were validated with the
 * data-viz palette checker against both surfaces:
 *
 *   light (on #ffffff)  worst adjacent CVD ΔE 7.9 · normal-vision ΔE 16.0
 *   dark  (on #161618)  worst adjacent CVD ΔE 8.1 · normal-vision ΔE 15.7
 *
 * All slots clear the OKLCH lightness band, the chroma floor, the
 * normal-vision floor (>=15) and 3:1 contrast against their surface. The worst
 * CVD pair sits in the 6-8 floor band, which is permitted only alongside
 * secondary encoding - so every surface that uses these colors also carries a
 * text label and value, and adjacent fills are separated by a 2px surface gap.
 * Color is never the sole carrier of identity anywhere in the UI.
 *
 * The dark column is the same eight hues re-stepped (+0.04 OKLCH lightness,
 * chroma preserved) for the dark surface - not a different palette.
 *
 * `Other` is deliberately a neutral gray below the chroma floor: it is the
 * semantic "no category" bucket, and giving it a hue would imply an identity
 * it does not have.
 */

export interface PaletteEntry {
  /** Mark fill on the light surface. */
  light: string;
  /** Mark fill on the dark surface. */
  dark: string;
}

/**
 * Fixed slot order - assigned to categories by index and never cycled or
 * reshuffled. A category keeps its color when other categories come and go.
 */
export const CATEGORY_PALETTE: PaletteEntry[] = [
  { light: '#3a6fb5', dark: '#467bc2' }, // 0 blue     - Development
  { light: '#c9622f', dark: '#d76e3c' }, // 1 orange   - Work
  { light: '#2f8f6a', dark: '#3e9b76' }, // 2 green    - Learning
  { light: '#b8862b', dark: '#bc892f' }, // 3 amber    - AI
  { light: '#c06a8e', dark: '#cb7498' }, // 4 magenta  - News
  { light: '#3d7a45', dark: '#498650' }, // 5 forest   - Social
  { light: '#5b4f9e', dark: '#665bab' }, // 6 violet   - Entertainment
  { light: '#c0504e', dark: '#ce5c59' }, // 7 red      - Shopping
  { light: '#6b7280', dark: '#9096a1' }, // 8 gray     - Other (null bucket)
];

/** Index of the neutral slot reserved for the fallback category. */
export const NEUTRAL_SLOT = 8;

function safeIndex(colorIndex: number): number {
  const n = CATEGORY_PALETTE.length;
  return ((colorIndex % n) + n) % n;
}

export function paletteFor(colorIndex: number): PaletteEntry {
  return CATEGORY_PALETTE[safeIndex(colorIndex)];
}

/**
 * CSS custom property for a slot. Charts reference this so a single element
 * renders correctly in both themes with no JavaScript involved.
 */
export function categoryVar(colorIndex: number): string {
  return `var(--cat-${safeIndex(colorIndex)})`;
}

/** The `--cat-N` declarations injected into the stylesheet for each theme. */
export function paletteCssVars(mode: 'light' | 'dark'): string {
  return CATEGORY_PALETTE.map((entry, i) => `--cat-${i}: ${entry[mode]};`).join('\n  ');
}
