import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildManifest } from './src/shared/manifest';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as {
  version: string;
};

/**
 * Emit `manifest.json` from the TypeScript definition so the product name,
 * version and permission rationale live in one reviewable place.
 */
function manifestPlugin(): Plugin {
  return {
    name: 'timescope:manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(buildManifest(pkg.version), null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), manifestPlugin()],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Extension pages load from disk, so there is no cache-busting benefit to
    // hashed filenames, and stable names make a build diff readable.
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, 'dashboard.html'),
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    // Source maps make the built worker debuggable in chrome://extensions
    // without shipping original sources to users of a packed build.
    sourcemap: false,
    target: 'esnext',
    minify: 'esbuild',
  },

  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
