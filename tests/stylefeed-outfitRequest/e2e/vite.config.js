import { mergeConfig } from 'vite'
import baseConfig from '../../../vite.config.js'

// Test app on separate ports from the team's normal dev server.
export default mergeConfig(baseConfig, {
  server: {
    host: '127.0.0.1', port: 5299, strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3299', changeOrigin: true } },
  },
})
