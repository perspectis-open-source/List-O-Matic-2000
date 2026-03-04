/**
 * Loads HTML slide files from this directory. Add slide-1.html, slide-2.html, etc.
 * Order is by filename (slide-1, slide-2, ...). Paste your HTML into each file.
 */
const modules = import.meta.glob('./slide-*.html', { query: '?raw', import: 'default', eager: true })

const sortedKeys = Object.keys(modules).sort()
function getContent(m: unknown): string {
  if (typeof m === 'string') return m
  if (m && typeof m === 'object' && 'default' in m && typeof (m as { default: unknown }).default === 'string') {
    return (m as { default: string }).default
  }
  return ''
}
export const SLIDES: string[] = sortedKeys.map((key) => getContent(modules[key]))
export const SLIDE_COUNT = SLIDES.length
