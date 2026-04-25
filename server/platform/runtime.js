import crypto from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createOperationalLogger } from './operationalLogger.js'

function assertCapabilities(mode, capabilities) {
  if (mode === 'standalone') {
    if (capabilities.governanceEvidenceEnabled) {
      throw new Error('Standalone mode cannot enable governance evidence.')
    }
    if (!capabilities.operationalLogsEnabled || !capabilities.basicJsonExportEnabled) {
      throw new Error('Standalone mode requires operational logs and basic JSON export.')
    }
    return
  }
  if (mode === 'integrated') {
    if (!capabilities.governanceEvidenceEnabled) {
      throw new Error('Integrated mode requires governance evidence support.')
    }
    if (!capabilities.operationalLogsEnabled) {
      throw new Error('Integrated mode requires operational logs.')
    }
  }
}

function readPlatformMode(env = process.env) {
  const mode = String(env.PLATFORM_MODE ?? 'integrated').trim().toLowerCase()
  if (mode !== 'integrated' && mode !== 'standalone') {
    throw new Error(`Invalid PLATFORM_MODE "${mode}". Expected "integrated" or "standalone".`)
  }
  return mode
}

function createStandaloneRuntime(env = process.env) {
  const logger = createOperationalLogger(env)
  const correlationAls = new AsyncLocalStorage()

  function expressCorrelationMiddleware() {
    return (req, res, next) => {
      const incoming = req.headers?.['x-correlation-id']
      const base = Array.isArray(incoming) ? incoming[0] : incoming
      const correlationId = String(base ?? '').trim() || crypto.randomUUID()
      res.setHeader('x-correlation-id', correlationId)
      correlationAls.run(correlationId, () => next())
    }
  }

  function getCorrelationIdFromStore() {
    return correlationAls.getStore()
  }

  async function withLlmEvidence(stepName, createParams, exec) {
    const startedAt = Date.now()
    const correlationId = getCorrelationIdFromStore()
    try {
      const out = await exec(createParams)
      logger.info('llm_call_success', {
        stepName,
        durationMs: Date.now() - startedAt,
        correlationId,
      })
      return out
    } catch (error) {
      logger.error('llm_call_failure', {
        stepName,
        durationMs: Date.now() - startedAt,
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  function registerOperationalRoutes(app) {
    app.get('/api/matcher-evidence', (_req, res) => {
      res.status(404).json({ error: 'evidence is unavailable in standalone mode' })
    })
  }

  const capabilities = {
    governanceEvidenceEnabled: false,
    matcherEvidenceEndpointEnabled: false,
    basicJsonExportEnabled: true,
    operationalLogsEnabled: true,
    evidenceUiMode: 'operational-logs',
  }
  assertCapabilities('standalone', capabilities)

  return {
    mode: 'standalone',
    capabilities,
    withLlmEvidence,
    expressCorrelationMiddleware,
    getCorrelationIdFromStore,
    registerOperationalRoutes,
    logger,
  }
}

async function createIntegratedRuntime(env = process.env) {
  const gov = await import('@syncsphere/vendor-governance/node')
  const { withLlmEvidence } = gov.createLlmEvidenceRuntimeFromProcessEnv({
    jsonlRelativePath: 'list-o-matic-evidence.jsonl',
    actor: 'list-o-matic-2000',
    logLabel: 'list-o-matic',
    env,
  })
  const logger = createOperationalLogger(env)
  const capabilities = {
    governanceEvidenceEnabled: true,
    matcherEvidenceEndpointEnabled: true,
    basicJsonExportEnabled: true,
    operationalLogsEnabled: true,
    evidenceUiMode: 'governance-evidence',
  }
  assertCapabilities('integrated', capabilities)
  return {
    mode: 'integrated',
    capabilities,
    withLlmEvidence,
    expressCorrelationMiddleware: gov.expressCorrelationMiddleware,
    getCorrelationIdFromStore: gov.getCorrelationIdFromStore,
    registerOperationalRoutes(app) {
      app.get(
        '/api/matcher-evidence',
        gov.createEvidenceJsonlGetHandler({
          env,
          jsonlRelativePath: 'list-o-matic-evidence.jsonl',
        }),
      )
    },
    logger,
  }
}

export async function createPlatformRuntime(env = process.env) {
  const mode = readPlatformMode(env)
  if (mode === 'standalone') return createStandaloneRuntime(env)
  return createIntegratedRuntime(env)
}
