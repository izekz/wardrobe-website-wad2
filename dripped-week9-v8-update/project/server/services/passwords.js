const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derive = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [scheme, salt, hex] = String(stored || '').split(':');
  if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
  const key = await derive(password, salt, 64);
  return timingSafeEqual(key, Buffer.from(hex, 'hex'));
}
module.exports = { hashPassword, verifyPassword };
