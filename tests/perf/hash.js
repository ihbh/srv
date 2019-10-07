const { performance } = require('perf_hooks');
const crypto = require('crypto');

let [, , hashname] = process.argv;

if (!hashname) {
  console.log('Available hash algorithms:', crypto.getHashes().sort().join(' '));
  process.exit(0);
}

let hash = buffer =>
  crypto
    .createHash(hashname)
    .update(buffer)
    .digest('hex');

if (hashname.endsWith('.js')) {
  let modname = hashname.slice(0, -3);
  console.log('require', modname);
  let modfn = require(modname);
  hash = buffer => modfn(buffer);
}

const INPUT_BIG = Buffer.from('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', 'base64');
const INPUT_SMALL = Buffer.from('whuhqweiuewyiuf', 'ascii');
const TIMEOUT = 5; // seconds

console.log('hash:', hashname);
console.log('time:', TIMEOUT, 's');

for (let input of [INPUT_SMALL, INPUT_BIG]) {
  console.log('input:', input.byteLength, 'bytes');

  let time = performance.now(); // 64 ns/call
  let nsum = 0;

  while (performance.now() < time + TIMEOUT * 1e3) {
    hash(input);
    nsum++;
  }

  console.log('perf:',
    nsum / TIMEOUT / 1e3 | 0, 'kh/s',
    nsum * input.byteLength / 1e6 / TIMEOUT | 0, 'mb/s');
}
