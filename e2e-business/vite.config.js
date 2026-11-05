import { mergeConfig } from 'vite'
import baseConfig from '../vite.config.js'

// The same app on its own ports, so the tests can run beside a normal `pnpm dev`.
export default mergeConfig(baseConfig, {
  server: { port: 5199, proxy: { '/api': { target: 'http://127.0.0.1:3199', changeOrigin: true } } },
})
