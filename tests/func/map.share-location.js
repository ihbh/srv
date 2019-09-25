const assert = require('assert');
const fw = require('../fw');

const MINUTE = 60;
const M = 1e-5; // en.wikipedia.org/wiki/Decimal_degrees#Precision
const KM = 1000 * M;
const GPS_1 = [51.5073, -0.1277]; // London
const TIME_1 = new Date('2015-03-21').getTime() / 1000 | 0;

let u1, u2, u3;

fw.runTest(async () => {
  u1 = fw.keys(123);
  u2 = fw.keys(456);
  u3 = fw.keys(789);

  let [lat, lon] = GPS_1;
  let time = TIME_1;

  let locs = [
    { user: u1, time, lat, lon },
    { user: u1, time: time + 3 * MINUTE, lat: lat - 3 * M, lon: lon + 4 * M },
    { user: u2, time: time + 10 * MINUTE, lat: lat + 6 * M, lon: lon - 7 * M },

    { user: u2, time: time + 5 * MINUTE, lat: lat + KM + 2 * M, lon: lon + KM + 3 * M },
    { user: u3, time: time + 7 * MINUTE, lat: lat + KM - 3 * M, lon: lon + KM + 4 * M },
    { user: u3, time: time + 9 * MINUTE, lat: lat + KM + 6 * M, lon: lon + KM - 7 * M },
  ];

  for (let { user, time, lat, lon } of locs)
    await shareLocation(user, time, [lat, lon]);

  await verifyLocation([lat, lon], [u1.uid, u2.uid]);
  await verifyLocation([lat + KM, lon + KM], [u2.uid, u3.uid]);
});

function makeTsKey(tsec) {
  let tskey = (tsec / 60 | 0).toString(16);
  while (tskey.length < 8) tskey = '0' + tskey;
  return tskey;
}

async function shareLocation(user, time, [lat, lon]) {
  let tskey = makeTsKey(time);
  let res = await fw.rpc('Batch.Run', [
    { name: 'RSync.AddFile', args: { path: `~/places/${tskey}/lat`, data: lat } },
    { name: 'RSync.AddFile', args: { path: `~/places/${tskey}/lon`, data: lon } },
    { name: 'RSync.AddFile', args: { path: `~/places/${tskey}/time`, data: time } },
  ], { authz: user });
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
