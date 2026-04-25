import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.mjs'])
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.cursor', '.next', 'coverage'])

const RULES = [
  {
    pattern: /from\s+['"]@syncsphere\/vendor-governance(?:\/node)?['"]/g,
    allowFile: (rel) => rel === 'server/platform/runtime.js',
    label: '@syncsphere/vendor-governance imports',
  },
  {
    pattern: /from\s+['"]@vendor-shared\/[^'"]+['"]/g,
    allowFile: () => false,
    label: '@vendor-shared imports',
  },
]

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    if (e.name.startsWith('.DS_Store')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (IGNORED_DIRS.has(e.name)) continue
      await walk(full, out)
      continue
    }
    if (!SCAN_EXT.has(path.extname(e.name))) continue
    out.push(full)
  }
  return out
}

async function main() {
  const files = await walk(rootDir)
  const violations = []

  for (const abs of files) {
    const rel = path.relative(rootDir, abs).replaceAll(path.sep, '/')
    const text = await fs.readFile(abs, 'utf8')
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0
      if (!rule.pattern.test(text)) continue
      if (rule.allowFile(rel)) continue
      violations.push({ rel, label: rule.label })
    }
  }

  if (violations.length > 0) {
    console.error('Import boundary violations found:')
    for (const v of violations) {
      console.error(`- ${v.rel} (${v.label})`)
    }
    process.exit(1)
  }
  console.log(`Import boundaries passed. Checked ${files.length} source files.`)
}

main().catch((err) => {
  console.error('verify-import-boundaries failed:', err)
  process.exit(1)
})
