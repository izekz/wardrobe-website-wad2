import { fileURLToPath } from 'node:url'
import { playwrightConfig } from '../playwright.config.js'

export default playwrightConfig(fileURLToPath(new URL('.', import.meta.url)), 'wop-e02')
