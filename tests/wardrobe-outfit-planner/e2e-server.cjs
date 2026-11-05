// Disposable local test environment. Deliberately does not import dotenv or server/server.js.
const path = require('node:path'), fs = require('node:fs'), { createRequire } = require('node:module')
const root = path.resolve(__dirname, '../..'), fromServer = createRequire(path.join(root, 'server/package.json'))
const express = fromServer('express'), mongoose = fromServer('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
process.env.NODE_ENV = 'test'
process.env.CLIENT_ORIGIN = 'http://127.0.0.1:4186'
const { loadUser, requireAuth } = fromServer('./middleware/authentication')
const { hashPassword } = fromServer('./services/passwords')
const { createWardrobeRouter } = fromServer('./routes/wardrobeRoutes')
const { createCommerceRouter } = fromServer('./routes/commerceRoutes')
const User = fromServer('./models/User'), Item = fromServer('./models/WardrobeItem')
const models = { User, Item, Outfit: fromServer('./models/SavedOutfit'), Product: fromServer('./models/Product') }
const password = 'Local-fixture-password-2026'
let database, server
async function stop() { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (database) await database.stop() }
process.once('SIGINT', () => stop().finally(() => process.exit()))
process.once('SIGTERM', () => stop().finally(() => process.exit()))
;(async () => {
  database = await MongoMemoryServer.create({ instance: { dbName: 'dripped_wardrobe_outfit_tests', ip: '127.0.0.1' } })
  const uri = database.getUri('dripped_wardrobe_outfit_tests')
  if (!uri.startsWith('mongodb://127.0.0.1:')) throw new Error('Refusing a non-local test database')
  await mongoose.connect(uri)
  if (mongoose.connection.name !== 'dripped_wardrobe_outfit_tests') throw new Error('Wrong disposable database')
  const passwordHash = await hashPassword(password)
  await User.create({ name: 'Wardrobe Student', email: 'wardrobe.student@example.invalid', role: 'consumer', passwordHash, surveyCompleted: true, preferredStyles: ['Minimalist'] })
  const planner = await User.create({ name: 'Planner Student', email: 'planner.student@example.invalid', role: 'consumer', passwordHash, surveyCompleted: true, preferredStyles: ['Minimalist'] })
  const photo = { data: fs.readFileSync(path.join(root, 'src/assets/images/survey/minimalist.jpg')), contentType: 'image/jpeg' }
  for (const [name, category, colour, material] of [['White linen shirt', 'Tops', 'White', 'Linen'], ['Black trousers', 'Bottoms', 'Black', 'Cotton'], ['Black loafers', 'Shoes', 'Black', 'Leather'], ['Blue overshirt', 'Tops', 'Blue', 'Cotton']])
    await Item.create({ userId: String(planner._id), name, category, colour, colours: [colour], style: ['Minimalist'], material, photo })
  const app = express()
  app.get('/__test/ready', (req, res) => res.json({ ready: true, database: 'temporary local MongoDB' }))
  app.use('/api', loadUser)
  app.use('/api/auth', express.json({ limit: '16kb' }), fromServer('./routes/authRoutes'))
  app.use('/api', requireAuth)
  app.use('/api/wardrobe', express.json({ limit: '8mb' }), createWardrobeRouter(models,
    async date => ({ available: true, date, location: 'Singapore', temperature: 31, weatherCode: 0, condition: 'Clear skies', rainChance: 10, tags: ['Warm'], advice: ['Choose breathable fabrics and light layers.'] }),
    async () => ({})))
  app.use('/api/commerce', express.json({ limit: '32kb' }), createCommerceRouter(models))
  app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint outside the Wardrobe and Outfit Planner test scope.' }))
  app.use(express.static(path.join(root, 'dist')))
  app.use((req, res, next) => req.method === 'GET' ? res.sendFile(path.join(root, 'dist/index.html')) : next())
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }))
  server = app.listen(4186, '127.0.0.1', () => console.log('Wardrobe & Outfit Planner test app ready. Local disposable MongoDB only; Atlas is never loaded.'))
})().catch(async error => { console.error(error.message); await stop(); process.exitCode = 1 })
