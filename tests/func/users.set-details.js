const assert = require('assert');
const sha1 = require('sha1');
const fw = require('../fw');
const cu = require('../cu');

fw.fetch.logs = true;

let uid, pubkey, privkey;

fw.runTest(async () => {
  let seed = cu.sha256('bar');
  uid = cu.sha256('foo').slice(0, 16);
  [pubkey, privkey] = cu.keypair(seed);

  await updateName('Joe1');
  await updateName('Joe2');
  await assert.rejects(
    updateName('Joe3', cu.sha512('foobar'),
      { message: 'RPC error: 401' }));
});

async function updateName(name, sig = null) {
  let photo = 'data:image/jpeg;base64,qwerty';
  let info = 'Howdy, I\'m Joe.';
  let rpcbody = { name, info, photo, pubkey };
  // HAZARD: Undeterministic JSON.stringify().
  let rpctext = JSON.stringify(rpcbody);

  if (sig) {
    assert(
      /^[0-9a-f]{128}$/.test(sig),
      'Invalid signature format.');
  } else {
    sig = cu.sign(rpctext, pubkey, privkey);
    assert(
      cu.verify(sig, rpctext, pubkey),
      'Invalid ed25519 signature.');
  }

  let token = { uid, sig };
  let headers = { Authorization: JSON.stringify(token) };

  let res1 = await fw.rpc('Users.SetDetails',
    rpcbody, { headers });
  assert.equal(res1.body, '');

  let res2 = await fw.rpc('Users.GetDetails',
    { users: [uid] });
  assert.deepEqual(res2.json, [rpcbody]);

  let res3 = await fw.rpc('Users.GetDetails',
    { users: [uid], props: ['name', 'photo'] });
  assert.deepEqual(res3.json, [{ name, photo }]);
}
