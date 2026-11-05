import { createRequire } from 'node:module'
import path from 'node:path'
import { projectRoot } from './test-settings.js'
import {
  adminAccount,
  customerAccount,
  businessAccount,
  productFixtures,
} from './fixtures.js'

const fromServer = createRequire(path.join(projectRoot, 'server/package.json'))
const { hashPassword } = fromServer('./services/passwords')
const User = fromServer('./models/User')
const Business = fromServer('./models/Business')
const Product = fromServer('./models/Product')

export async function seedTestData() {
  const passwordHash = await hashPassword(adminAccount.password)
  const accounts = [adminAccount, customerAccount, businessAccount]
  const users = []

  for (const account of accounts) {
    users.push(await User.create({
      name: account.name,
      email: account.email,
      role: account.role,
      passwordHash,
      suspended: false,
      surveyCompleted: true,
      preferredStyles: ['Minimalist'],
      activities: ['University'],
      budget: 40,
    }))
  }

  const owner = users.find(user => user.role === 'business')
  const business = await Business.create({
    ownerId: String(owner._id),
    businessName: 'Profile Test Shop',
    description: 'Disposable shop created only for automated testing.',
    styles: ['Minimalist'],
    contact: businessAccount.email,
  })

  const photo = {
    data: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64'
    ),
    contentType: 'image/png',
  }

  for (const fixture of productFixtures) {
    await Product.create({
      ...fixture,
      businessId: String(business._id),
      businessName: business.businessName,
      photo,
    })
  }

  return { accounts: users.length, products: productFixtures.length }
}
