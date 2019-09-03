const crypto = require('crypto');
const sc = require('supercop.wasm')

exports.scready = new Promise(
  resolve => sc.ready(
    () => resolve()));

exports.keypair = seed => {
  let { publicKey, secretKey } =
    sc.createKeyPair(Buffer.from(seed, 'hex'));
  return [
    Buffer.from(publicKey).toString('hex'),
    Buffer.from(secretKey).toString('hex')];
};

exports.sign = (text, pubkey, privkey) => {
  let sig = sc.sign(
    Buffer.from(text, 'utf8'),
    Buffer.from(pubkey, 'hex'),
    Buffer.from(privkey, 'hex'));
  return Buffer.from(sig).toString('hex');
};

exports.verify = (sig, text, pubkey) => {
  return sc.verify(
    Buffer.from(sig, 'hex'),
    Buffer.from(text, 'utf8'),
    Buffer.from(pubkey, 'hex'));
};

exports.sha256 = input =>
  crypto
    .createHash('sha256')
    .update(input)
    .digest('hex');

exports.sha512 = input =>
  crypto
    .createHash('sha512')
    .update(input)
    .digest('hex');
