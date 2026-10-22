// Focused Style Feed interaction regression tests, no browser/database required.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const file = path.resolve(__dirname, '../../src/view/styleFeed/StyleFeed.vue')
const source = fs.readFileSync(file, 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  .replace(/^import .*$/gm, '').replace('export default', 'module.exports =')
assert.ok(script)
const shim = { exports: {} }
const timers = new Map()
let nextTimer = 1
const storage = new Map()
let fakeNow = 1000
vm.runInNewContext(script, {
  module: shim,
  authState: { user: { role: 'customer' } },
  styleFeedApi: async () => ({ videos: [] }),
  sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  setTimeout: fn => { const id = nextTimer++; timers.set(id, fn); return id },
  clearTimeout: id => timers.delete(id),
  Date: { now: () => fakeNow },
}, { filename: 'StyleFeed.vue script' })
const component = shim.exports

function setup() {
  const videos = ['A', 'B', 'C'].map((videoId, i) => ({ videoId, boosted: i === 1 }))
  const elements = videos.map((_, index) => ({
    dataset: { feedIndex: String(index) }, muted: true,
    pauses: 0, plays: 0,
    pause() { this.pauses++ },
    play() { this.plays++; return Promise.resolve() },
  }))
  const viewer = {
    clientHeight: 600, scrollHeight: 1800, scrollTop: 0,
    querySelectorAll: () => elements,
    querySelector: selector => elements[Number(selector.match(/\d+/)[0])] || null,
    scrollTo({ top, behavior }) { this.scrollTop = top; this.lastBehavior = behavior },
  }
  const instance = {
    ...component.data(), loading: false, videos,
    $refs: { feedViewer: viewer },
    $nextTick: cb => cb ? cb() : Promise.resolve(),
    tracked: [],
  }
  Object.defineProperty(instance, 'activePost', { get: () => component.computed.activePost.call(instance) })
  Object.defineProperty(instance, 'activeId', { get: () => component.computed.activeId.call(instance) })
  for (const [name, method] of Object.entries(component.methods)) instance[name] = method.bind(instance)
  instance.track = (...args) => { instance.tracked.push(args); return Promise.resolve() }
  return { feed: instance, viewer, elements }
}

function fireTimer(id) {
  const fn = timers.get(id)
  assert.ok(fn, 'a settle timer exists')
  timers.delete(id)
  fn()
}

test('CSS uses native vertical scrolling with one-card snap stops, including on mobile', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/assets/styles/styleFeed.css'), 'utf8')
  assert.match(css, /overflow-y:auto/)
  assert.match(css, /scroll-snap-type:y mandatory/)
  assert.match(css, /scroll-snap-stop:always/)
  assert.match(css, /touch-action:pan-y/)
  assert.match(source, /v-for="\(post, index\) in videos"/)
  assert.match(source, /@wheel="onWheel"/)
  assert.doesNotMatch(source, /@wheel\.prevent/, 'normal trackpad scrolling must never be prevented')
})

test('Style Feed video frame stays in 9:16 portrait across responsive sizes', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/assets/styles/styleFeed.css'), 'utf8')
  assert.match(css, /\.sf-video-stage\{[^}]*aspect-ratio:9\/16/)
  assert.match(css, /\.sf-viewer\{[^}]*--sf-video-height:min\(/)
  assert.match(css, /\.sf-viewer\{[^}]*--sf-video-height:min\(/)
  assert.match(css, /\.community-style-feed\{[^}]*height:100dvh/, 'the feed route uses the available screen height')
  assert.match(css, /\.sf-product-card\{[^}]*align-self:flex-end/, 'product details stay outside the video frame')
  assert.match(css, /\.sf-video-stage video\{[^}]*object-fit:cover/, 'square and landscape source videos fill the player')
  assert.match(css, /@media\(max-width:767px\)/)
  assert.match(css, /@media\(max-width:480px\)/)
})

test('native trackpad wheel events never lock after the first gesture', () => {
  const { feed, viewer } = setup()
  let prevented = 0
  const wheel = (deltaY) => feed.onWheel({ deltaY, preventDefault() { prevented++ } })
  wheel(30); wheel(180); wheel(25)
  assert.equal(prevented, 0, 'wheel motion must be left to the browser')
  assert.equal(feed.activeId, 'A', 'JavaScript does not jump videos on trackpad events')
  viewer.scrollTop = 600
  feed.onScroll()
  fireTimer(feed.scrollSettleTimer)
  assert.equal(feed.activeId, 'B', 'native scrolling still activates the next video')
  fakeNow += 60
  wheel(-100); wheel(60)
  viewer.scrollTop = 0
  feed.onScroll()
  fireTimer(feed.scrollSettleTimer)
  assert.equal(feed.activeId, 'A', 'scrolling back up still works')
  assert.equal(prevented, 0, 'no sticky scroll lock after changing direction')
})

test('scroll settles on nearest video, and the previous video pauses', () => {
  const { feed, viewer, elements } = setup()
  feed.playActive()
  assert.equal(elements[0].plays, 1)
  viewer.scrollTop = 610
  feed.onScroll()
  fireTimer(feed.scrollSettleTimer)
  assert.equal(feed.activeId, 'B')
  assert.equal(elements[0].pauses > 0, true)
  assert.equal(elements[1].plays, 1)
  assert.deepEqual(feed.tracked, [['B', 'impression']])
})

test('last video loops only on a later downward gesture, not momentum; top never wraps', () => {
  const { feed, viewer } = setup()
  let prevented = 0
  const wheel = deltaY => feed.onWheel({ deltaY, preventDefault() { prevented++ } })
  feed.activeIndex = 2
  viewer.scrollTop = 1200
  feed.onScroll() // native scroll has just arrived at the final card
  fireTimer(feed.scrollSettleTimer)
  wheel(100)
  assert.equal(feed.activeId, 'C', 'arrival momentum does not immediately loop')
  fakeNow += 170
  wheel(10)
  assert.equal(feed.activeId, 'C', 'tail of same gesture stays on last video')
  fakeNow += 450
  wheel(60)
  assert.equal(feed.activeId, 'A', 'next deliberate downward gesture loops')
  assert.equal(viewer.scrollTop, 0)
  assert.equal(prevented, 1, 'preventDefault is used for wrapping only')
  fakeNow += 450
  wheel(-300)
  assert.equal(feed.activeId, 'A', 'scrolling up at the first card cannot wrap')
  assert.equal(prevented, 1)
})

test('arrow keys navigate one video, ignore repeated keys and text inputs', () => {
  const { feed, viewer } = setup()
  let prevented = 0
  const key = { key: 'ArrowDown', target: { closest: () => null }, preventDefault() { prevented++ } }
  feed.onKeydown(key)
  assert.equal(feed.activeId, 'B')
  assert.equal(viewer.lastBehavior, 'smooth')
  feed.onKeydown({ ...key, repeat: true })
  assert.equal(feed.activeId, 'B')
  feed.onKeydown({ ...key, target: { closest: () => ({ tagName: 'INPUT' }) } })
  assert.equal(feed.activeId, 'B')
  feed.onKeydown({ ...key, key: 'ArrowUp' })
  assert.equal(feed.activeId, 'A')
  feed.onKeydown({ ...key, key: 'ArrowUp' })
  assert.equal(feed.activeId, 'A')
  assert.equal(prevented, 4)
})

test('touch swipes scroll natively; only swipes that start at bottom loop', () => {
  const { feed, viewer } = setup()
  feed.onTouchStart({ touches: [{ clientY: 260, clientX: 10 }] })
  feed.onTouchEnd({ changedTouches: [{ clientY: 70, clientX: 15 }] })
  assert.equal(feed.activeId, 'A', 'normal touch scrolling is left to the browser')
  feed.activeIndex = 2
  viewer.scrollTop = 1200
  feed.onTouchStart({ touches: [{ clientY: 260, clientX: 10 }] })
  feed.onTouchEnd({ changedTouches: [{ clientY: 70, clientX: 15 }] })
  assert.equal(feed.activeId, 'A')
  assert.equal(viewer.scrollTop, 0)
})

test('sponsored impression counts once even if revisited', () => {
  const { feed } = setup()
  feed.navigate(1)
  feed.navigate(-1)
  feed.navigate(1)
  assert.deepEqual(feed.tracked, [['B', 'impression']])
})

test('empty and one-video feeds do not navigate or wrap', () => {
  const { feed } = setup()
  feed.videos = []
  feed.navigate(1)
  feed.onWheel({ deltaY: 200, preventDefault() { assert.fail('empty feed should not wrap') } })
  assert.equal(feed.activeIndex, 0)
  feed.videos = [{ videoId: 'solo', boosted: false }]
  feed.navigate(-1)
  feed.navigate(1)
  assert.equal(feed.activeIndex, 0)
})

test('loading state ignores navigation while the feed is refreshing', () => {
  const { feed } = setup()
  feed.loading = true
  feed.navigate(1)
  assert.equal(feed.activeIndex, 0)
})
