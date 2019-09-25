import * as sc from 'supercop.wasm';
import log from './log';

sc.ready(() => log.v('supercop is ready'));

export function verify(text: Buffer, sig: Buffer, pubkey: Buffer) {
  if (sig.length != 64)
    throw new Error('Invalid sig size: ' + sig.length);
  if (pubkey.length != 32)
    throw new Error('Invalid pubkey size: ' + pubkey.length);
  return sc.verify(sig, text, pubkey);
}
