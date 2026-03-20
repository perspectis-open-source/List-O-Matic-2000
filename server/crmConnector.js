/**
 * @file crmConnector.js
 * @description Generic CRM export connector. Provides POST /api/crm/export (upsert contacts)
 * and GET /api/crm/status (feature detection). All CRM logic is isolated in this file.
 * Enable by setting CRM_BASE_URL + CRM_API_KEY env vars; omit them to disable.
 * @module List-O-Matic-2000/server
 */
import { Router } from 'express'

const CRM_BASE_URL = (process.env.CRM_BASE_URL ?? '').trim()
const CRM_API_KEY = (process.env.CRM_API_KEY ?? '').trim()
const CRM_AUTH_HEADER = (process.env.CRM_AUTH_HEADER ?? 'Authorization').trim()
const CRM_UPSERT_ENDPOINT = (process.env.CRM_UPSERT_ENDPOINT ?? '/contacts').trim()

const MAX_CONTACTS = 10_000
const CONCURRENCY = 5
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000
const REQUEST_TIMEOUT_MS = 15_000

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

export function isCrmEnabled() {
  return CRM_BASE_URL !== '' && CRM_API_KEY !== ''
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateCrmExportBody(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body' }

  const { contacts, fieldMapping, upsertEndpoint } = body

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return { ok: false, error: 'contacts must be a non-empty array' }
  }
  if (contacts.length > MAX_CONTACTS) {
    return { ok: false, error: `contacts exceeds maximum of ${MAX_CONTACTS.toLocaleString()} items` }
  }
  for (let i = 0; i < contacts.length; i++) {
    if (!contacts[i] || typeof contacts[i] !== 'object' || Array.isArray(contacts[i])) {
      return { ok: false, error: `contacts[${i}] must be a non-null object` }
    }
  }

  if (!fieldMapping || typeof fieldMapping !== 'object' || Array.isArray(fieldMapping)) {
    return { ok: false, error: 'fieldMapping must be a non-empty object' }
  }
  const mappingEntries = Object.entries(fieldMapping).filter(
    ([k, v]) => typeof k === 'string' && typeof v === 'string' && v.trim() !== ''
  )
  if (mappingEntries.length === 0) {
    return { ok: false, error: 'fieldMapping must have at least one non-empty mapping' }
  }

  const emailSourceKey = mappingEntries.find(([, v]) => v.trim() === 'email')?.[0]
  if (!emailSourceKey) {
    return { ok: false, error: 'fieldMapping must include a field mapped to "email" (the upsert key)' }
  }

  for (let i = 0; i < contacts.length; i++) {
    const emailVal = contacts[i][emailSourceKey]
    if (emailVal == null || String(emailVal).trim() === '') {
      return { ok: false, error: `contacts[${i}] is missing a value for "${emailSourceKey}" (mapped to email)` }
    }
  }

  if (upsertEndpoint !== undefined) {
    if (typeof upsertEndpoint !== 'string' || !upsertEndpoint.startsWith('/')) {
      return { ok: false, error: 'upsertEndpoint must be a string starting with "/"' }
    }
  }

  return {
    ok: true,
    contacts,
    fieldMapping: Object.fromEntries(mappingEntries),
    emailSourceKey,
    upsertEndpoint: upsertEndpoint ?? CRM_UPSERT_ENDPOINT,
  }
}

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

export function mapContactFields(contact, fieldMapping) {
  const mapped = {}
  for (const [sourceKey, crmField] of Object.entries(fieldMapping)) {
    const trimmed = crmField.trim()
    if (!trimmed) continue
    mapped[trimmed] = contact[sourceKey] ?? ''
  }
  return mapped
}

// ---------------------------------------------------------------------------
// Single-contact upsert with retry
// ---------------------------------------------------------------------------

function isRetryable(status) {
  return status === 429 || status >= 500
}

function jitteredDelay(attempt) {
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt) * (0.5 + Math.random())
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function upsertSingleContact(mappedContact, url, authHeaderName, authHeaderValue) {
  let lastError = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = jitteredDelay(attempt - 1)
      console.log(`[CRM] Retry ${attempt}/${MAX_RETRIES} for ${mappedContact.email} after ${Math.round(delay)}ms`)
      await sleep(delay)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const startMs = Date.now()

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [authHeaderName]: authHeaderValue,
        },
        body: JSON.stringify(mappedContact),
        signal: controller.signal,
      })

      clearTimeout(timeout)
      const elapsedMs = Date.now() - startMs

      if (res.status === 201) {
        console.log(`[CRM] Created ${mappedContact.email} (${elapsedMs}ms)`)
        return { email: mappedContact.email, status: 'created' }
      }
      if (res.ok) {
        console.log(`[CRM] Updated ${mappedContact.email} (${elapsedMs}ms)`)
        return { email: mappedContact.email, status: 'updated' }
      }

      if (isRetryable(res.status) && attempt < MAX_RETRIES) {
        console.warn(`[CRM] ${res.status} for ${mappedContact.email} (${elapsedMs}ms), will retry`)
        lastError = `${res.status}: ${res.statusText}`
        continue
      }

      let errorDetail = `${res.status}: ${res.statusText}`
      try {
        const errBody = await res.text()
        if (errBody) errorDetail = `${res.status}: ${errBody.slice(0, 200)}`
      } catch {}

      console.warn(`[CRM] Failed ${mappedContact.email}: ${errorDetail} (${elapsedMs}ms)`)
      return { email: mappedContact.email, status: 'failed', error: errorDetail }
    } catch (err) {
      clearTimeout(timeout)
      const elapsedMs = Date.now() - startMs
      const msg = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Network error')

      if (err.name !== 'AbortError' && attempt < MAX_RETRIES) {
        console.warn(`[CRM] Network error for ${mappedContact.email}: ${msg} (${elapsedMs}ms), will retry`)
        lastError = msg
        continue
      }

      console.warn(`[CRM] Failed ${mappedContact.email}: ${msg} (${elapsedMs}ms)`)
      return { email: mappedContact.email, status: 'failed', error: msg }
    }
  }

  return { email: mappedContact.email, status: 'failed', error: lastError || 'Max retries exceeded' }
}

// ---------------------------------------------------------------------------
// Batch upsert with concurrency control
// ---------------------------------------------------------------------------

async function upsertContacts(contacts, fieldMapping, upsertEndpoint) {
  const url = CRM_BASE_URL + upsertEndpoint
  const authValue = `Bearer ${CRM_API_KEY}`

  const results = []
  let index = 0

  async function worker() {
    while (index < contacts.length) {
      const i = index++
      const mapped = mapContactFields(contacts[i], fieldMapping)
      const result = await upsertSingleContact(mapped, url, CRM_AUTH_HEADER, authValue)
      results[i] = result
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, contacts.length) }, () => worker())
  await Promise.all(workers)

  return results
}

// ---------------------------------------------------------------------------
// Express router
// ---------------------------------------------------------------------------

export const crmRouter = Router()

crmRouter.get('/api/crm/status', (_req, res) => {
  res.status(200).json({ enabled: isCrmEnabled() })
})

crmRouter.post('/api/crm/export', async (req, res, next) => {
  try {
    if (!isCrmEnabled()) {
      return res.status(503).json({ error: 'CRM export is not configured. Set CRM_BASE_URL and CRM_API_KEY.' })
    }

    const validated = validateCrmExportBody(req.body)
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error })
    }

    const { contacts, fieldMapping, upsertEndpoint } = validated

    console.log(`[CRM] Starting export: ${contacts.length} contacts to ${CRM_BASE_URL}${upsertEndpoint}`)
    const startMs = Date.now()

    const results = await upsertContacts(contacts, fieldMapping, upsertEndpoint)

    const created = results.filter((r) => r.status === 'created').length
    const updated = results.filter((r) => r.status === 'updated').length
    const failed = results.filter((r) => r.status === 'failed').length
    const errors = results.filter((r) => r.status === 'failed').map((r) => ({ email: r.email, error: r.error }))

    const elapsedMs = Date.now() - startMs
    console.log(`[CRM] Export complete: ${created} created, ${updated} updated, ${failed} failed (${elapsedMs}ms)`)

    return res.status(200).json({
      totalSent: contacts.length,
      created,
      updated,
      failed,
      errors,
    })
  } catch (err) {
    console.error('[CRM] Unexpected error:', err.message || err)
    next(err)
  }
})
