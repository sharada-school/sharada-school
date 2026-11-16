const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const PASSWORD_HASH_PREFIX = 'bcrypt-sha256$';
const BCRYPT_ROUNDS = 12;

const preparePassword = (password) =>
  crypto.createHash('sha256').update(String(password), 'utf8').digest('hex');

const hashPassword = async (password) =>
  `${PASSWORD_HASH_PREFIX}${await bcrypt.hash(preparePassword(password), BCRYPT_ROUNDS)}`;

const verifyPassword = async (password, storedValue) => {
  const stored = String(storedValue || '');
  if (stored.startsWith(PASSWORD_HASH_PREFIX)) {
    return {
      valid: await bcrypt.compare(preparePassword(password), stored.slice(PASSWORD_HASH_PREFIX.length)),
      needsRehash: false
    };
  }

  const providedBuffer = Buffer.from(String(password));
  const storedBuffer = Buffer.from(stored);
  const valid = providedBuffer.length === storedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, storedBuffer);
  return { valid, needsRehash: valid };
};

module.exports = { hashPassword, verifyPassword };