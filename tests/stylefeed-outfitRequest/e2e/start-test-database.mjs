// Start an isolated local MongoDB replica set for Style Feed and Outfit Request E2E tests.
// mongodb-memory-server is already a root devDependency of this project.
// No system-wide mongod installation, team Atlas URI or server/.env is used.
// MongoDB transactions need a replica set, so a single MongoMemoryReplSet is used.
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { createServer } from 'node:http'

const mongoPort = 27129
const readyPort = 27128
const databaseName = 'wardrobe_stylefeed_outfitrequest_e2e'
let replicaSet
let readyServer
let shuttingDown = false

async function stop() {
  if (shuttingDown) return
  shuttingDown = true
  if (readyServer) await new Promise(resolve => readyServer.close(resolve))
  if (replicaSet) await replicaSet.stop()
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stop().then(() => process.exit(0)).catch(error => {
      console.error('Could not stop temporary test MongoDB:', error.message)
      process.exit(1)
    })
  })
}

try {
  replicaSet = await MongoMemoryReplSet.create({
    instanceOpts: [{ ip: '127.0.0.1', port: mongoPort }],
    replSet: { count: 1, name: 'rsStyleOutfit', storageEngine: 'wiredTiger' },
  })
  const uri = replicaSet.getUri(databaseName)
  if (!uri.startsWith(`mongodb://127.0.0.1:${mongoPort}/${databaseName}`)
      || !uri.includes('replicaSet=rsStyleOutfit')) {
    throw new Error(`Unsafe test database URI; refusing to start: ${uri}`)
  }
  readyServer = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Isolated Style Feed and Outfit Request test MongoDB ready')
  })
  await new Promise((resolve, reject) => {
    readyServer.once('error', reject)
    readyServer.listen(readyPort, '127.0.0.1', resolve)
  })
  console.log('Isolated MongoDB replica set ready at 127.0.0.1:27129 (temporary database only).')
} catch (error) {
  console.error('Could not start isolated MongoDB for the E2E tests:', error)
  console.error('Run pnpm install at the project root. The first run may download a MongoDB binary.')
  await stop().catch(() => {})
  process.exit(1)
}
