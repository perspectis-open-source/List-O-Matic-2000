import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024
const DEFAULT_MAX_FILES = 5

function parsePositiveInt(raw, fallback) {
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function createOperationalLogger(env = process.env) {
  const filePath = String(env.OPS_LOG_FILE ?? '').trim()
  const maxBytes = parsePositiveInt(env.OPS_LOG_MAX_BYTES, DEFAULT_MAX_BYTES)
  const maxFiles = parsePositiveInt(env.OPS_LOG_MAX_FILES, DEFAULT_MAX_FILES)
  let rotateQueue = Promise.resolve()

  async function rotateIfNeeded() {
    if (!filePath) return
    const st = await fs.stat(filePath).catch(() => null)
    if (!st || st.size < maxBytes) return
    for (let i = maxFiles - 1; i >= 1; i -= 1) {
      const from = `${filePath}.${i}`
      const to = `${filePath}.${i + 1}`
      await fs.rename(from, to).catch(() => {})
    }
    await fs.rename(filePath, `${filePath}.1`).catch(() => {})
  }

  async function appendLine(line) {
    if (!filePath) return
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.appendFile(filePath, `${line}\n`, 'utf8')
    rotateQueue = rotateQueue.then(rotateIfNeeded).catch(() => {})
  }

  function write(level, message, fields = {}) {
    const payload = {
      ts: new Date().toISOString(),
      level,
      message,
      ...fields,
    }
    const line = JSON.stringify(payload)
    if (level === 'error') console.error(`[ops] ${message}`, fields)
    else if (level === 'warn') console.warn(`[ops] ${message}`, fields)
    else console.log(`[ops] ${message}`, fields)
    void appendLine(line)
  }

  return {
    info(message, fields) {
      write('info', message, fields)
    },
    warn(message, fields) {
      write('warn', message, fields)
    },
    error(message, fields) {
      write('error', message, fields)
    },
    config: { filePath, maxBytes, maxFiles },
  }
}
