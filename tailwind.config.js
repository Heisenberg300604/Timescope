/**
 * Tailwind is used for layout and spacing only. Every color resolves to a CSS
 * custom property defined in `src/styles/theme.css`, so light and dark mode are
 * a single attribute swap on <html> with no class churn and no flash.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'surface-hover': 'var(--surface-hover)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        'control-line': 'var(--control-line)',
        ink: 'var(--ink)',
        'ink-secondary': 'var(--ink-secondary)',
        'ink-muted': 'var(--ink-muted)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-soft': 'var(--accent-soft)',
        'accent-ink': 'var(--accent-ink)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
      },
      fontFamily: {
        // Loaded entirely from the system. The extension makes no network
        // requests, so a webfont is not an option - nor is one needed when
        // every target platform ships an excellent UI sans.
        sans: [
          'Inter', 'ui-sans-serif', 'system-ui', '-apple-system',
          'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif',
        ],
        mono: [
          'ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo',
          'Consolas', 'Liberation Mono', 'monospace',
        ],
      },
      fontSize: {
        // A deliberately small scale - five steps cover the whole product.
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.011em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.014em' }],
        '3xl': ['2rem', { lineHeight: '2.375rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.75rem', { lineHeight: '3rem', letterSpacing: '-0.025em' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
      transitionDuration: { DEFAULT: '150ms' },
    },
  },
  plugins: [],
};
