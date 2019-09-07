const assert = require('assert');
const fw = require('../fw');
const cu = require('../cu');

const MINUTE = 60 * 1000;
const M = 1e-5; // en.wikipedia.org/wiki/Decimal_degrees#Precision
const KM = 1000 * M;
const LATLON_1 = [51.5073509, -0.1277583]; // London
const TIME_1 = new Date('2015-03-21').getTime() / MINUTE | 0;

let uid, pubkey, privkey;

fw.runTest(async () => {
  let seed = cu.sha256('bar');
  uid = cu.sha256('foo').slice(0, 16);
  [pubkey, privkey] = cu.keypair(seed);

  let [lat, lon] = LATLON_1;
  let time = TIME_1;

  let loc1 = [
    { time, lat, lon },
    { time: time + 3, lat: lat - 3 * M, lon: lon + 4 * M },
    { time: time + 10, lat: lat + 6 * M, lon: lon - 7 * M },
  ];

  let loc2 = [
    { time: time + 5, lat: lat + KM + 2 * M, lon: lon + KM + 3 * M },
    { time: time + 7, lat: lat + KM - 3 * M, lon: lon + KM + 4 * M },
    { time: time + 9, lat: lat + KM + 6 * M, lon: lon + KM - 7 * M },
  ];

  for (let { time, lat, lon } of [...loc1, ...loc2])
    await shareLocation(time, [lat, lon]);

  await verifyLocation([lat, lon],
    loc1.map(
      pos => ({ user: uid, ...pos })));

  await verifyLocation([lat + KM, lon + KM],
    loc2.map(
      pos => ({ user: uid, ...pos })));
});

async function shareLocation(time, [lat, lon]) {
  let rpcbody = { lat, lon, time };
  // HAZARD: Undeterministic JSON.stringify().
  let rpctext = JSON.stringify(rpcbody);
  let rpcurl = fw.rpcurl('Map.ShareLocation');
  let signed = rpcurl + '\n' + rpctext;
  let sig = cu.sign(signed, pubkey, privkey);
  assert(
    cu.verify(sig, signed, pubkey),
    'Invalid ed25519 signature.');

  let token = { uid, sig };
  let headers = { Authorization: JSON.stringify(token) };

  let res = await fw.rpc('Map.ShareLocation',
    rpcbody, { headers });
  assert.equal(res.body, '');
}

async function verifyLocation([lat, lon], locations) {
  let res = await fw.rpc('Map.GetPeopleNearby',
    { lat, lon });
  assert.deepEqual(res.json, locations);
}