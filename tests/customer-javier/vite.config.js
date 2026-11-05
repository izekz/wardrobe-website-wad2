import { mergeConfig } from 'vite'
import mainConfig from '../../vite.config.js'

// Separate local ports, matching the group's Business test setup.
export default mergeConfig(mainConfig, {
  server: {
    host: '127.0.0.1', port: 5387, strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:3387', changeOrigin: true } },
  },
})
