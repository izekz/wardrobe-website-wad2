// An isolated single-node replica set for Style Feed and Outfit Request E2E tests.
// A replica set is required because Style Feed coin purchases use MongoDB transactions.
// This NEVER connects to the team's Atlas database or reads server/.env.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const requireFromServer = createRequire(new URL('../../../server/server.js', import.meta.url))
const mongoose = requireFromServer('mongoose')
const { MongoClient } = mongoose.mongo
const mongoPort = 27129
const readyPort = 27128
const folder = join(tmpdir(), 'wardrobe-stylefeed-outfitRequest-e2e-db')
rmSync(folder, { recursive: true, force: true })
mkdirSync(folder, { recursive: true })

const child = spawn('mongod', [
  '--dbpath', folder, '--port', String(mongoPort), '--bind_ip', '127.0.0.1',
  '--replSet', 'rsStyleOutfit', '--quiet',
], { stdio: 'ignore' })
child.on('error', error => { console.error('MongoDB is required for the E2E tests. Install mongod and ensure it is on your PATH.', error.message); process.exit(1) })
child.on('exit', code => { console.error('Javier test MongoDB stopped.'); process.exit(code || 1) })
let readyServer
async function shutdown() {
  readyServer?.close()
  child.kill('SIGTERM')
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }
async function initialize() {
  let client
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      client = new MongoClient(`mongodb://127.0.0.1:${mongoPort}/?directConnection=true`, { serverSelectionTimeoutMS: 800 })
      await client.connect()
      break
    } catch {
      await client?.close().catch(() => {})
      if (child.exitCode !== null) throw new Error('mongod exited before becoming available.')
      await sleep(250)
    }
  }
  if (!client) throw new Error('Timed out starting isolated MongoDB.')
  try {
    await client.db('admin').command({ replSetInitiate: {
      _id: 'rsStyleOutfit', members: [{ _id: 0, host: `127.0.0.1:${mongoPort}` }],
    } })
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const status = await client.db('admin').command({ hello: 1 })
        if (status.isWritablePrimary) return
      } catch { /* Election in progress */ }
      await sleep(250)
    }
    throw new Error('Replica set did not become primary.')
  } finally {
    await client.close()
  }
}

try {
  await initialize()
  readyServer = createServer((_req, res) => { res.writeHead(200); res.end('test MongoDB ready') })
  readyServer.listen(readyPort, '127.0.0.1', () => console.log('Isolated Style Feed/Outfit Request test database ready'))
} catch (error) {
  console.error(error.message)
  await shutdown()
  process.exit(1)
}
