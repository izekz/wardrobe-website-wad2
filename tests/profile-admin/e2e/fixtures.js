// Disposable fixture accounts only. These are not the team's real accounts.
const password = 'Profile-admin-test-2026!'

export const adminAccount = {
  name: 'Profile Admin Tester',
  email: 'profile.admin@example.invalid',
  password,
  role: 'admin',
}

export const customerAccount = {
  name: 'Profile Customer Tester',
  email: 'profile.customer@example.invalid',
  password,
  role: 'consumer',
}

export const businessAccount = {
  name: 'Profile Business Tester',
  email: 'profile.business@example.invalid',
  password,
  role: 'business',
}

export const productFixtures = [
  {
    name: 'Test White Shirt',
    category: 'Tops',
    style: 'Minimalist',
    colours: ['White'],
    material: 'Cotton',
    occasions: ['University'],
    sizes: ['M'],
    sizeStock: [{ size: 'M', stock: 5 }],
    stock: 5,
    price: 25,
    description: 'Disposable product for the profile and admin test app.',
    status: 'active',
  },
  {
    name: 'Test Black Trousers',
    category: 'Bottoms',
    style: 'Minimalist',
    colours: ['Black'],
    material: 'Cotton',
    occasions: ['University'],
    sizes: ['M'],
    sizeStock: [{ size: 'M', stock: 5 }],
    stock: 5,
    price: 35,
    description: 'Disposable product for the profile and admin test app.',
    status: 'active',
  },
]
