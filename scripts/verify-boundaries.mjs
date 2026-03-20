import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOssFileList, loadExportConfig, verifyBlockedPatternsInFiles } from './lib/ossExport.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

async function main() {
  const config = await loadExportConfig(rootDir)
  const files = await buildOssFileList(rootDir)
  const violations = await verifyBlockedPatternsInFiles(files, rootDir, config.blockedTokenPatterns)

  if (violations.length > 0) {
    console.error('Boundary verification failed. Blocked patterns found:')
    for (const v of violations) {
      console.error(`- ${v.file} (pattern: ${v.pattern})`)
    }
    process.exit(1)
  }

  console.log(`Boundary verification passed. Checked ${files.length} files.`)
}

main().catch((err) => {
  console.error('Boundary verification error:', err)
  process.exit(1)
})
