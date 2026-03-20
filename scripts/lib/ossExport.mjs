import fs from 'node:fs/promises'
import path from 'node:path'

const TEXT_FILE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.yml', '.yaml', '.env', '.txt', '.css', '.html',
])

function isTextFile(filePath) {
  const ext = path.extname(filePath)
  return TEXT_FILE_EXTENSIONS.has(ext) || path.basename(filePath) === '.env.example'
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readConfig(rootDir) {
  const configPath = path.join(rootDir, 'oss-export.config.json')
  const raw = await fs.readFile(configPath, 'utf8')
  return JSON.parse(raw)
}

async function collectFilesRecursively(targetPath, out = []) {
  const stat = await fs.stat(targetPath)
  if (stat.isFile()) {
    out.push(targetPath)
    return out
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.oss-export') continue
    const full = path.join(targetPath, entry.name)
    if (entry.isDirectory()) {
      await collectFilesRecursively(full, out)
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
  return out
}

export async function buildOssFileList(rootDir) {
  const config = await readConfig(rootDir)
  const files = []

  for (const rel of config.allowedPaths) {
    const absolute = path.join(rootDir, rel)
    if (!(await pathExists(absolute))) continue
    await collectFilesRecursively(absolute, files)
  }

  return [...new Set(files)].sort()
}

export async function verifyBlockedPatternsInFiles(filePaths, rootDir, blockedPatterns) {
  const violations = []
  const regexes = blockedPatterns.map((p) => new RegExp(p))

  for (const filePath of filePaths) {
    if (!isTextFile(filePath)) continue
    const rel = path.relative(rootDir, filePath)
    const content = await fs.readFile(filePath, 'utf8')
    for (const re of regexes) {
      if (re.test(content)) {
        violations.push({ file: rel, pattern: re.source })
      }
    }
  }

  return violations
}

export async function createExport(rootDir, destinationDir, filePaths) {
  await fs.rm(destinationDir, { recursive: true, force: true })
  await fs.mkdir(destinationDir, { recursive: true })

  for (const src of filePaths) {
    const rel = path.relative(rootDir, src)
    const dest = path.join(destinationDir, rel)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.copyFile(src, dest)
  }
}

export async function loadExportConfig(rootDir) {
  return readConfig(rootDir)
}
