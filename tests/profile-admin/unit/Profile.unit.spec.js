import { describe, it, expect } from 'vitest'
import Profile from '../../../src/view/auth/Profile.vue'

describe('Customer profile: style selection limit', () => {
  it('UT01: rejects a third style when two are already selected', () => {
    const profile = Profile.data()

    profile.form.preferredStyles = [
      'Minimalist',
      'Streetwear',
    ]

    Profile.methods.toggleStyle.call(profile, 'Vintage')

    expect(profile.form.preferredStyles).toEqual([
      'Minimalist',
      'Streetwear',
    ])

    expect(profile.form.preferredStyles).toHaveLength(2)

    expect(profile.error).toBe('Choose up to two styles.')
  })
})
