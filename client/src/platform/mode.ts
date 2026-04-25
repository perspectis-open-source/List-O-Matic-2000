export type PlatformMode = 'integrated' | 'standalone'

export function readPlatformMode(): PlatformMode {
  const mode = String(import.meta.env.VITE_PLATFORM_MODE ?? 'integrated').trim().toLowerCase()
  if (mode !== 'integrated' && mode !== 'standalone') {
    throw new Error(`Invalid VITE_PLATFORM_MODE "${mode}". Expected "integrated" or "standalone".`)
  }
  return mode
}

export const PLATFORM_MODE = readPlatformMode()
