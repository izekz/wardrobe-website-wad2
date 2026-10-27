// Camera lifecycle tests use fake media tracks. They never access a physical camera.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { parse } = require('../../node_modules/vue/compiler-sfc');
const filename = path.join(__dirname, '../../src/components/CameraCapture.vue');
const script = parse(fs.readFileSync(filename, 'utf8')).descriptor.script.content
  .replace(/^import .+\n/gm, '').replace('export default', 'globalThis.component =');

function camera(getUserMedia, { secure = true } = {}) {
  const canvas = { getContext: () => ({ drawImage() {} }), toBlob: fn => fn(new Blob(['jpeg-test'], { type: 'image/jpeg' })) };
  const sandbox = { CommunityIcon: {}, File, window: { isSecureContext: secure }, navigator: { mediaDevices: { getUserMedia } }, document: { createElement: () => canvas } };
  vm.runInNewContext(script, sandbox);
  const options = sandbox.component, events = [];
  const dialog = { open: false, showModal() { this.open = true }, close() { this.open = false } };
  const instance = { ...options.data(), disabled: false, $refs: { dialog, video: { srcObject: null, play: async () => {}, videoWidth: 2400, videoHeight: 1800 } }, $emit: (...args) => events.push(args) };
  for (const [name, method] of Object.entries(options.methods)) instance[name] = method.bind(instance);
  return { instance, events, canvas, options };
}

test('Camera starts only on request, captures JPEG, and stops after capture', async () => {
  let calls = 0, stops = 0;
  const track = { stop() { stops++ } };
  const { instance, events, canvas } = camera(async options => { calls++; assert.equal(options.audio, false); return { getTracks: () => [track] } });
  assert.equal(calls, 0);
  await instance.openCamera(); instance.ready = true;
  await instance.takePhoto();
  assert.equal(calls, 1); assert.equal(stops, 1); assert.equal(instance.$refs.dialog.open, false);
  assert.equal(events[0][0], 'photo'); assert.equal(events[0][1].type, 'image/jpeg');
  assert.equal(canvas.width, 1600); assert.equal(canvas.height, 1200);
});
test('A late camera permission result is stopped after cancellation', async () => {
  let allow, stops = 0;
  const { instance } = camera(() => new Promise(resolve => { allow = resolve }));
  const pending = instance.openCamera();
  instance.closeCamera();
  allow({ getTracks: () => [{ stop() { stops++ } }] });
  await pending;
  assert.equal(stops, 1); assert.equal(instance.stream, null); assert.equal(instance.$refs.dialog.open, false);
});
test('Permission denial and insecure origins show useful messages and allow file upload', async () => {
  const denied = camera(async () => { const error = new Error(); error.name = 'NotAllowedError'; throw error });
  await denied.instance.openCamera(); assert.match(denied.instance.error, /permission was denied/);
  denied.instance.chooseFile(); assert.equal(denied.events[0][0], 'choose-file');
  const insecure = camera(async () => { throw new Error('should not request camera') }, { secure: false });
  await insecure.instance.openCamera(); assert.match(insecure.instance.error, /HTTPS or localhost/);
});
test('Leaving the component stops the active camera', async () => {
  let stops = 0;
  const { instance, options } = camera(async () => ({ getTracks: () => [{ stop() { stops++ } }] }));
  await instance.openCamera(); options.beforeUnmount.call(instance);
  assert.equal(stops, 1); assert.equal(instance.$refs.video.srcObject, null);
});
