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
    // Single graph for app + linked `@vendor-shared` source (shared’s own node_modules would otherwise load a second React/MUI).
    dedupe: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/system',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
    ],
    alias: {
      // Must match tsconfig `paths`: `@vendor-shared/*` -> `shared/src/*`
      '@vendor-shared': vendorSharedSrcRoot,
      // Keep a single React graph for app and local platform modules.
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
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
