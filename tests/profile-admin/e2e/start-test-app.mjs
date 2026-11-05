// Starts real application routes against a disposable local MongoDB replica set.
// Never imports server/server.js or dotenv: the team's Atlas settings are not loaded.
import { createRequire } from 'node:module'
import { createServer as createHTTPServer } from 'node:http'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { createServer as createViteServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import {
  projectRoot, host, frontendPort, testBaseURL, databaseName,
} from './test-settings.js'
import { seedTestData } from './seed-test-data.js'

const fromServer = createRequire(path.join(projectRoot, 'server/package.json'))
const express = fromServer('express')
const cors = fromServer('cors')
const mongoose = fromServer('mongoose')

process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = testBaseURL
process.env.COMMUNITY_DEMO_MODE = 'false'

let database
let backend
let frontend
let frontendHTTP
let runtimeFolder
let fixtureCounts
let stopping = false
let stopPromise

function ensureRunning() {
  if (stopping) throw new Error('Test application startup was cancelled.')
}

async function stop() {
  if (stopPromise) return stopPromise

  stopPromise = (async () => {
    const failures = []
    if (frontend) {
      await frontend.close().catch(error => failures.push(error))
    }
    if (frontendHTTP) {
      frontendHTTP.closeAllConnections?.()
      await new Promise(resolve => frontendHTTP.close(resolve))
    }
    if (backend) {
      backend.closeAllConnections?.()
      await new Promise(resolve => backend.close(resolve))
    }
    await mongoose.disconnect().catch(error => failures.push(error))
    if (database) {
      await database.stop({ doCleanup: true, force: true })
        .catch(error => failures.push(error))
    }
    if (runtimeFolder) {
      await rm(runtimeFolder, { recursive: true, force: true })
        .catch(error => failures.push(error))
    }
    if (failures.length) {
      throw new Error(failures.map(error => error.message).join('; '))
    }
    console.log('Profile/admin test services stopped; temporary database and runtime files removed.')
  })()

  return stopPromise
}

async function start() {
  runtimeFolder = await mkdtemp(path.join(tmpdir(), 'dripped-profile-admin-'))
  const dbPath = path.join(runtimeFolder, 'mongo')
  await mkdir(dbPath)
  ensureRunning()

  database = await MongoMemoryReplSet.create({
    binary: {
      downloadDir: path.join(tmpdir(), 'dripped-e2e-mongodb-binaries'),
    },
    instanceOpts: [{ ip: host, dbPath }],
    replSet: {
      count: 1,
      name: 'rsProfileAdmin',
      storageEngine: 'wiredTiger',
      // Let this supervisor stop MongoDB after closing the app connections.
      spawn: { detached: process.platform !== 'win32' },
    },
  })
  ensureRunning()

  const uri = database.getUri(databaseName)
  if (!uri.startsWith(`mongodb://${host}:`) || !uri.includes(`/${databaseName}?`)) {
    throw new Error('Refusing to connect to a non-local or unexpected test database.')
  }
  process.env.MONGODB_URI = uri
  process.env.DB = uri
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
  ensureRunning()

  const { loadUser, requireAuth } = fromServer('./middleware/authentication')
  const { createCommunityRouter } = fromServer('./routes/community')
  const { createBusinessRouter, createCatalogRouter } = fromServer('./routes/business')
  const { createWardrobeRouter } = fromServer('./routes/wardrobeRoutes')
  const { router: styleFeedRouter } = fromServer('./routes/styleFeed')

  const app = express()
  app.use(cors({ origin: testBaseURL, credentials: true }))
  app.get('/api/health', async (req, res, next) => {
    try {
      await mongoose.connection.db.command({ ping: 1 })
      res.json({ status: 'ok', database: databaseName, fixtures: fixtureCounts })
    } catch (error) { next(error) }
  })
  app.use('/api', loadUser)
  app.use('/api/auth', express.json({ limit: '16kb' }), fromServer('./routes/authRoutes'))
  app.use('/api', requireAuth)
  app.use('/api/admin', fromServer('./routes/adminRoutes'))
  app.use('/api/reports', fromServer('./routes/reportRoutes'))
  app.use('/api/survey', express.json({ limit: '16kb' }), fromServer('./routes/surveyRoutes'))
  app.use('/api/commerce', express.json({ limit: '32kb' }), fromServer('./routes/commerceRoutes'))
  app.use('/api/catalog', express.json({ limit: '16kb' }), createCatalogRouter())
  app.use('/api/business', express.json({ limit: '16mb' }), createBusinessRouter())
  app.use('/api/community', express.json({ limit: '8mb' }), createCommunityRouter())
  app.use('/api/wardrobe', express.json({ limit: '8mb' }), createWardrobeRouter())
  app.use('/api/style-feed', express.json({ limit: '12mb' }), styleFeedRouter)
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    console.error('Profile/admin test API error:', error.message)
    res.status(error.status || 500).json({ message: error.message })
  })

  await Promise.all(Object.values(mongoose.models).map(model => model.init()))
  fixtureCounts = await seedTestData()
  ensureRunning()

  backend = app.listen(0, host)
  await new Promise((resolve, reject) => {
    backend.once('listening', resolve)
    backend.once('error', reject)
  })
  const backendPort = backend.address().port
  ensureRunning()

  frontendHTTP = createHTTPServer()
  frontend = await createViteServer({
    configFile: false,
    root: projectRoot,
    cacheDir: path.join(runtimeFolder, 'vite-cache'),
    plugins: [vue()],
    server: {
      host,
      port: frontendPort,
      strictPort: true,
      // Own HTTP lifecycle so Vite does not exit before MongoDB cleanup.
      middlewareMode: true,
      hmr: { server: frontendHTTP },
      proxy: {
        '/api': { target: `http://${host}:${backendPort}`, changeOrigin: true },
      },
    },
  })
  ensureRunning()
  frontendHTTP.on('request', frontend.middlewares)
  await new Promise((resolve, reject) => {
    frontendHTTP.once('error', reject)
    frontendHTTP.listen(frontendPort, host, resolve)
  })
  ensureRunning()
  console.log(`Profile/admin E2E app ready at ${testBaseURL}; seeded ${fixtureCounts.accounts} accounts and ${fixtureCounts.products} products.`)
}

const startup = start()
startup.catch(async error => {
  console.error('Unable to start profile/admin test app:', error.message)
  await stop().catch(cleanupError => console.error(cleanupError.message))
  process.exitCode = 1
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    stopping = true
    await startup.catch(() => {})
    try {
      await stop()
      process.exit(0)
    } catch (error) {
      console.error('Profile/admin test cleanup failed:', error.message)
      process.exit(1)
    }
  })
}
