const { test } = require('node:test');
const assert = require('node:assert/strict');
const { productInput } = require('../businessValidation');
const { resolveColourPhotos, imageFor } = require('../services/colourPhotos');
const { listedColours } = require('../services/listedColours');

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const image = name => ({ data: Buffer.from(name), contentType: 'image/png' });
const shoe = { name: 'Runner', price: 80, category: 'Shoes', style: 'Casual', colours: ['Black'], material: 'Mesh', occasions: ['Casual'], description: 'Light runner.', photo: png };

test('an older listing only offers the colour it names, not every ticked colour', () => {
  const colours = ['Black', 'White', 'Red', 'Blue'];
  assert.deepEqual(listedColours({ name: 'Black shirt', colours }), ['Black']);
  assert.deepEqual(listedColours({ name: 'Tight shirt', description: 'Plain black fitted shirt', colours }), ['Black']);
  assert.deepEqual(listedColours({ name: 'Plain shirt', description: 'Soft cotton', colours }), colours);
  assert.deepEqual(listedColours({ name: 'Black shirt', colours: ['Black', 'Red'], colourPhotos: [{ colour: 'Black' }, { colour: 'Red' }] }), ['Black', 'Red']);
});

test('one colour only needs the main photo', () => {
  const photo = image('main');
  assert.deepEqual(resolveColourPhotos({ colours: ['Black'], photo }), { photo, colourPhotos: [] });
});

test('every colour needs a photo when there are several', () => {
  assert.throws(() => resolveColourPhotos({ colours: ['Black', 'Red'], photo: image('main') }), /Add a photo for Red/);
  assert.throws(() => resolveColourPhotos({ colours: ['Black', 'Red'], uploads: { Red: image('red') } }), /Add a photo for Black/);
  const made = resolveColourPhotos({ colours: ['Black', 'Red'], uploads: { Black: image('black'), Red: image('red') } });
  assert.equal(made.photo.data.toString(), 'black');
  assert.equal(made.colourPhotos[0].data, undefined);
  assert.equal(made.colourPhotos[1].data.toString(), 'red');
  assert.throws(() => resolveColourPhotos({ colours: ['Black', 'Red', 'Blue', 'Navy', 'Pink', 'Grey', 'White'], uploads: {} }), /up to 6/);
});

test('editing keeps saved colour photos and an older listing keeps its photo', () => {
  const older = { photo: image('main') };
  const added = resolveColourPhotos({ colours: ['Black', 'Red'], uploads: { Red: image('red') } }, older);
  assert.equal(added.photo.data.toString(), 'main');
  const stored = { photo: added.photo, colourPhotos: added.colourPhotos };
  const swapped = resolveColourPhotos({ colours: ['Red', 'Black'] }, stored);
  assert.equal(swapped.photo.data.toString(), 'red');
  assert.equal(swapped.colourPhotos[1].data.toString(), 'main');
  const single = resolveColourPhotos({ colours: ['Red'] }, stored);
  assert.equal(single.photo.data.toString(), 'red');
  assert.deepEqual(single.colourPhotos, []);
  assert.equal(imageFor(stored.colourPhotos[0], stored.photo).data.toString(), 'main');
});

test('shoes only accept US number sizes', () => {
  const input = productInput({ ...shoe, sizeStock: { 9: 2, '9.5': 1 } }, { photoRequired: true });
  assert.deepEqual(input.sizes.sort(), ['9', '9.5']);
  for (const size of ['S', 'XS', 'US 9', '9.25', '0', '21', 'One size']) {
    assert.throws(() => productInput({ ...shoe, sizeStock: [{ size, stock: 1 }] }, { photoRequired: true }), /US number sizes/);
    assert.throws(() => productInput({ ...shoe, sizes: [size], stock: 1 }, { photoRequired: true }), /US number sizes/);
  }
  assert.deepEqual(productInput({ ...shoe, category: 'Tops', sizeStock: { S: 1 } }, { photoRequired: true }).sizes, ['S']);
});
