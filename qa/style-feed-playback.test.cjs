const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const source = fs.readFileSync(path.join(root, 'src/view/styleFeed/StyleFeed.vue'), 'utf8')
const css = fs.readFileSync(path.join(root, 'src/assets/styles/styleFeed.css'), 'utf8')
const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1]
assert.ok(script, 'StyleFeed Vue script exists')
const code = script.replace(/^import\s+.*$/gm, '').replace('export default', 'module.exports =')
const sandbox = { module: { exports: {} }, authState: { user: null }, styleFeedApi: () => Promise.resolve() }
vm.runInNewContext(code, sandbox, { filename: 'StyleFeed.vue' })
const component = sandbox.module.exports

function feed() {
  const video = { currentTime: 0, duration: 40 }
  const post = { videoId: 'video-A' }
  const context = {
    activeId: post.videoId, playbackProgress: {}, viewed: new Set(),
    trackCalls: [], track(id, kind) { this.trackCalls.push([id, kind]) },
    videos: [post], videoAt() { return video }
  }
  return { post, video, context }
}

test('progress follows actual video currentTime and duration', () => {
  const { post, video, context } = feed()
  video.currentTime = 10
  component.methods.onProgress.call(context, post, { target: video })
  assert.equal(context.playbackProgress[post.videoId], 25)
  video.currentTime = 30
  component.methods.onProgress.call(context, post, { target: video })
  assert.equal(context.playbackProgress[post.videoId], 75)
  video.currentTime = 0 // video loops or viewer seeks to beginning
  component.methods.onProgress.call(context, post, { target: video })
  assert.equal(context.playbackProgress[post.videoId], 0)
})

test('seeking updates playback position without needing a network call', () => {
  const { post, video, context } = feed()
  component.methods.seekVideo.call(context, 0, { target: { value: '62.5' } })
  assert.equal(video.currentTime, 25)
  assert.equal(context.playbackProgress[post.videoId], 62.5)
})

test('only active videos count as viewed and view is tracked once', () => {
  const { post, video, context } = feed()
  video.currentTime = 1
  component.methods.onProgress.call(context, post, { target: video })
  assert.equal(context.trackCalls.length, 0)
  video.currentTime = 2.5
  component.methods.onProgress.call(context, post, { target: video })
  component.methods.onProgress.call(context, post, { target: video })
  assert.equal(context.trackCalls.length, 1)
  context.activeId = 'another-video'
  video.currentTime = 12
  component.methods.onProgress.call(context, post, { target: video })
  assert.equal(context.playbackProgress[post.videoId], 6.25)
})

test('product card is separate from the video frame, with distinct product/store links', () => {
  const template = source.match(/<template>([\s\S]*?)<\/template>/)?.[1]
  assert.ok(template)
  const videoStageEnd = template.indexOf('</div>\n          <aside class="sf-product-card"')
  assert.ok(videoStageEnd > 0, 'Product card comes after video frame closes')
  assert.equal((template.match(/class="sf-post-footer"/g) || []).length, 0, 'Old video product banner removed')
  assert.match(template, /@click="openProduct\(post\)"/)
  assert.match(template, /@click="openStore\(post\)"/)
  assert.match(template, /type="range"[\s\S]*?@input="seekVideo\(index, \$event\)"/)
  assert.match(css, /#f52a52/)
  assert.match(css, /@media\(max-width:767px\)/)
})
