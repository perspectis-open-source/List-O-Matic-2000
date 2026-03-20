import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildOssFileList, createExport, loadExportConfig, verifyBlockedPatternsInFiles } from './lib/ossExport.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const exportDir = path.join(rootDir, '.oss-export')

async function collectExportFiles(targetPath, out = []) {
  const entries = await fs.readdir(targetPath, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(targetPath, entry.name)
    if (entry.isDirectory()) {
      await collectExportFiles(full, out)
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
  return out
}

async function main() {
  const config = await loadExportConfig(rootDir)
  const files = await buildOssFileList(rootDir)
  await createExport(rootDir, exportDir, files)

  const exportedFiles = await collectExportFiles(exportDir)
  const violations = await verifyBlockedPatternsInFiles(exportedFiles, exportDir, config.blockedTokenPatterns)

  if (violations.length > 0) {
    console.error('OSS export verification failed. Blocked patterns found in export:')
    for (const v of violations) {
      console.error(`- ${v.file} (pattern: ${v.pattern})`)
    }
    process.exit(1)
  }

  const markerPath = path.join(exportDir, 'EXPORT_MANIFEST.json')
  await fs.writeFile(
    markerPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        fileCount: files.length,
      },
      null,
      2
    )
  )

  console.log(`OSS export verification passed. Exported ${files.length} files to ${path.relative(rootDir, exportDir)}.`)
}

main().catch((err) => {
  console.error('OSS export verification error:', err)
  process.exit(1)
})
