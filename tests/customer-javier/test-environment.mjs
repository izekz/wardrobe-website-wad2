import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoMemoryServer } from 'mongodb-memory-server'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const serverRequire = createRequire(join(projectRoot, 'server/package.json'))
const mongoose = serverRequire('mongoose')
const User = serverRequire('./models/User')
const Product = serverRequire('./models/Product')
const Business = serverRequire('./models/Business')
const { hashPassword } = serverRequire('./services/passwords')
const host = '127.0.0.1'
const frontendPort = 5387
const backendPort = 3387
const origin = `http://${host}:${frontendPort}`
const password = 'Local-customer-fixture-2026'
let db
const children = []
let stopping = false

async function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM')
  }
  await Promise.all(children.map(child => new Promise(resolve => {
    if (child.exitCode !== null) return resolve()
    child.once('exit', resolve)
    setTimeout(resolve, 2500)
  })))
  await mongoose.disconnect().catch(() => {})
  if (db) await db.stop().catch(() => {})
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stop().finally(() => process.exit(0)) })
}
process.on('uncaughtException', error => { console.error(error); stop().finally(() => process.exit(1)) })

function start(program, args, cwd, env) {
  const child = spawn(program, args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' })
  children.push(child)
  child.on('error', error => { console.error('Test service failed:', error.message); stop().finally(() => process.exit(1)) })
  child.on('exit', code => { if (!stopping) { console.error(`A test service stopped unexpectedly (${code}).`); stop().finally(() => process.exit(1)) } })
}

async function setup() {
  db = await MongoMemoryServer.create({ instance: { dbName: 'dripped_javier_customer_tests', ip: host } })
  const uri = db.getUri('dripped_javier_customer_tests')
  if (!uri.startsWith(`mongodb://${host}:`)) throw new Error('Refusing non-local MongoDB connection')
  await mongoose.connect(uri)

  const hash = await hashPassword(password)
  await User.create({ name: 'Customer Fixture', email: 'customer.fixture@example.invalid',
    passwordHash: hash, role: 'consumer', surveyCompleted: false,
    preferredStyles: [], activities: [], budget: 40 })
  const owner = await User.create({ name: 'Fixture Business Owner', email: 'owner.fixture@example.invalid',
    passwordHash: hash, role: 'business' })
  const business = await Business.create({ ownerId: String(owner._id), businessName: 'Fixture Studio',
    description: 'Customer E2E test product shop', styles: ['Vintage'], contact: 'owner.fixture@example.invalid' })
  const photo = { data: readFileSync(join(projectRoot, 'src/assets/images/survey/minimalist.jpg')), contentType: 'image/jpeg' }
  await Product.create({ businessId: String(business._id), businessName: business.businessName,
    name: 'Javier Test Jacket', price: 35, style: 'Vintage', category: 'Jackets',
    colours: ['Beige'], material: 'Cotton', occasions: ['Date', 'Presentation'], sizes: ['M'],
    sizeStock: [{ size: 'M', stock: 5 }], stock: 5, description: 'A lightweight jacket for test shopping.',
    photo, status: 'active' })
  await Product.create({ businessId: String(business._id), businessName: business.businessName,
    name: 'Javier Test High Price Jacket', price: 90, style: 'Vintage', category: 'Jackets',
    colours: ['Beige'], material: 'Cotton', occasions: ['Date'], sizes: ['M'],
    sizeStock: [{ size: 'M', stock: 4 }], stock: 4, description: 'A high price test product for All Items.',
    photo, status: 'active' })
  await mongoose.disconnect()

  start(process.execPath, ['server.js'], join(projectRoot, 'server'), {
    PORT: String(backendPort), MONGODB_URI: uri, DB: uri,
    CLIENT_ORIGIN: origin, NODE_ENV: 'test',
  })
  start(process.execPath, ['node_modules/vite/bin/vite.js', '--config',
    'tests/customer-javier/vite.config.js'], projectRoot, {})
  console.log(`Javier E2E environment starting at ${origin} (temporary local MongoDB).`)
}
setup().catch(error => { console.error('Failed to create the temporary test environment:', error.message); stop().finally(() => process.exit(1)) })
