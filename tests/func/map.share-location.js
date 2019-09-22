const assert = require('assert');
const fw = require('../fw');
const cu = require('../cu');

const MINUTE = 60;
const M = 1e-5; // en.wikipedia.org/wiki/Decimal_degrees#Precision
const KM = 1000 * M;
const GPS_1 = [51.5073, -0.1277]; // London
const TIME_1 = new Date('2015-03-21').getTime() / 1000 | 0;

let uid, pubkey, privkey;

fw.runTest(async () => {
  let seed = cu.sha256('bar');
  uid = cu.sha256('foo').slice(0, 16);
  [pubkey, privkey] = cu.keypair(seed);

  let [lat, lon] = GPS_1;
  let time = TIME_1;

  let loc1 = [
    { time, lat, lon },
    { time: time + 3 * MINUTE, lat: lat - 3 * M, lon: lon + 4 * M },
    { time: time + 10 * MINUTE, lat: lat + 6 * M, lon: lon - 7 * M },
  ];

  let loc2 = [
    { time: time + 5 * MINUTE, lat: lat + KM + 2 * M, lon: lon + KM + 3 * M },
    { time: time + 7 * MINUTE, lat: lat + KM - 3 * M, lon: lon + KM + 4 * M },
    { time: time + 9 * MINUTE, lat: lat + KM + 6 * M, lon: lon + KM - 7 * M },
  ];

  for (let { time, lat, lon } of [...loc1, ...loc2])
    await shareLocation(time, [lat, lon]);

  await verifyLocation([lat, lon], [uid]);
  await verifyLocation([lat + KM, lon + KM], [uid]);
});

function makeTsKey(tsec) {
  let tskey = (tsec / 60 | 0).toString(16);
  while (tskey.length < 8) tskey = '0' + tskey;
  return tskey;
}

async function shareLocation(time, [lat, lon]) {
  let tskey = makeTsKey(time);
  let res = await fw.rpc('Batch.Run', [
    { name: 'RSync.AddFile', args: { path: `~/places/${tskey}/lat`, data: lat } },
    { name: 'RSync.AddFile', args: { path: `~/places/${tskey}/lon`, data: lon } },
    { name: 'RSync.AddFile', args: { path: `~/places/${tskey}/time`, data: time } },
  ], { authz: { uid, pubkey, privkey } });
  assert.equal(res.statusCode, 200);
}

async function verifyLocation([lat, lon], uids) {
  let res = await fw.rpc('Map.GetVisitors',
    { lat, lon });
  let uids1 = new Set(Object.keys(res.json));
  let uids2 = new Set(uids);
  assert.deepEqual(
    [...uids1],
    [...uids2]);
}
