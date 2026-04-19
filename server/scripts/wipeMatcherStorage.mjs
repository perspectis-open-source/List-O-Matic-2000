/**
 * Removes persisted matcher data only (not .env or examples):
 * - All *.jsonl in MATCHER_KEYBOOK_DIR or default server/data/matcher-keybook
 * - All *.json / *.jsonl under server/data/matcher-snapshots (legacy snapshots)
 */
import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getMatcherKeybookDir } from '../matcherKeybook.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverRoot = path.join(__dirname, '..')

async function unlinkMatching(dir, ok) {
  let names
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  const removed = []
  for (const n of names) {
    if (!ok(n)) continue
    const p = path.join(dir, n)
    try {
      await fs.unlink(p)
      removed.push(p)
    } catch {
      /* ignore */
    }
  }
  return removed
}

const keybookDir = getMatcherKeybookDir()
const keybookRemoved = await unlinkMatching(keybookDir, (n) => n.endsWith('.jsonl'))

const snapshotsDir = path.join(serverRoot, 'data', 'matcher-snapshots')
const snapRemoved = await unlinkMatching(
  snapshotsDir,
  (n) => n.endsWith('.json') || n.endsWith('.jsonl'),
)

console.log('[wipe-matcher-data] keybook dir:', keybookDir)
console.log('[wipe-matcher-data] removed jsonl:', keybookRemoved.length ? keybookRemoved.join('\n') : '(none)')
console.log('[wipe-matcher-data] snapshots dir:', snapshotsDir)
console.log('[wipe-matcher-data] removed snapshots:', snapRemoved.length ? snapRemoved.join('\n') : '(none)')
