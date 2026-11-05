import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const projectRoot = fileURLToPath(new URL('../../../', import.meta.url))
export const host = '127.0.0.1'
export const frontendPort = Number(process.env.PROFILE_ADMIN_E2E_PORT || 5399)

if (!Number.isInteger(frontendPort) || frontendPort < 1024 || frontendPort > 65535) {
  throw new Error('PROFILE_ADMIN_E2E_PORT must be an available port from 1024 to 65535.')
}

export const testBaseURL = `http://${host}:${frontendPort}`
export const databaseName = 'dripped_profile_admin_e2e'
export const reportFolder = path.join(projectRoot, 'playwright-report-profile-admin')
export const resultsFolder = path.join(projectRoot, 'test-results-profile-admin')
