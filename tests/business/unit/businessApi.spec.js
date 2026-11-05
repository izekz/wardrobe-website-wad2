import { describe, it, expect } from 'vitest'
import { bestProduct } from '../../../src/services/businessApi'

// bestProduct() chooses which product a business suggests first for a customer request.
const request = { title: 'Need a jacket', description: 'For my presentation', preferredStyle: 'Minimalist', budget: 50 }
const jacket = { name: 'Blazer', category: 'Jackets', style: 'Minimalist', price: 45 }
const dress = { name: 'Dress', category: 'Dresses', style: 'Minimalist', price: 30 }

describe('Unit test: bestProduct', () => {
  it('picks the product that matches what the customer asked for', () => {
    expect(bestProduct([dress, jacket], request)).toBe(jacket)
  })

  it('picks the product within budget when the rest of the fit is the same', () => {
    const overBudget = { ...jacket, name: 'Designer blazer', price: 90 }
    expect(bestProduct([overBudget, jacket], request)).toBe(jacket)
  })

  it('picks the cheaper product when two fit equally well', () => {
    const cheaper = { ...jacket, name: 'Cheaper blazer', price: 35 }
    expect(bestProduct([jacket, cheaper], request)).toBe(cheaper)
  })
})
