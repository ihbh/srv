import * as crypto from 'crypto';
import wasm from 'ed25519.wasm';

function sha512(input: Buffer): Buffer {
  return crypto
    .createHash('sha512')
    .update(input)
    .digest();
}

export function verify(text: Buffer, sig: Buffer, pubkey: Buffer) {
  if (sig.length != 64)
    throw new Error('Invalid sig size: ' + sig.length);
  if (pubkey.length != 32)
    throw new Error('Invalid pubkey size: ' + pubkey.length);
  let hash = sha512(text);
  return wasm.verify(sig, hash, pubkey);
}
