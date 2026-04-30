/**
 * @file vite.config.ts
 * @description Vite + Vitest config: React plugin, /api proxy, jsdom, coverage, test setup.
 * @module List-O-Matic-2000/client
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const vendorSharedPackageRoot = path.resolve(__dirname, '../../shared')
const vendorSharedSrcRoot = path.join(vendorSharedPackageRoot, 'src')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Must match tsconfig `paths`: `@vendor-shared/*` -> `shared/src/*`
      '@vendor-shared': vendorSharedSrcRoot,
    },
  },
  server: {
    fs: {
      allow: [vendorSharedPackageRoot, vendorSharedSrcRoot],
    },
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', '**/*.stories.*', '**/*.spec.ts', 'e2e/**'],
    },
  },
})
