const crypto = require('crypto');
const ed25519 = require('ed25519.wasm')

const sha512 = input =>
  crypto
    .createHash('sha512')
    .update(input)
    .digest('hex');

const sha256 = input =>
  crypto
    .createHash('sha256')
    .update(input)
    .digest('hex');

const mhash = input =>
  crypto
    .createHash('sha512')
    .update(input)
    .digest();

exports.sha256 = sha256;
exports.sha512 = sha512;
exports.scready = ed25519.init();

exports.keypair = seed => {
  let [publicKey, secretKey] =
    ed25519.createKeypair(
      Buffer.from(seed, 'hex'));
  return [
    Buffer.from(publicKey).toString('hex'),
    Buffer.from(secretKey).toString('hex')];
};

exports.sign = (text, pubkey, privkey) => {
  let sig = ed25519.sign(
    mhash(text),
    Buffer.from(pubkey, 'hex'),
    Buffer.from(privkey, 'hex'));
  return Buffer.from(sig).toString('hex');
};

exports.verify = (sig, text, pubkey) => {
  return ed25519.verify(
    Buffer.from(sig, 'hex'),
    mhash(text),
    Buffer.from(pubkey, 'hex'));
};
