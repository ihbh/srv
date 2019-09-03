const assert = require('assert');
const sha1 = require('sha1');
const fw = require('../fw');

fw.fetch.logs = true;

fw.runTest(async () => {
  let uid = sha1('foo').slice(0, 16);
  let photo = 'data:image/jpeg;base64,qwerty';
  let pubkey = sha1('bar').repeat(2).slice(0, 64);
  let sig = sha1('bar').repeat(4).slice(0, 128);
  let info = 'Howdy, I\'m Joe.';
  let details = { name: 'Joe', info, photo, pubkey };
  let token = { uid, sig };
  let headers = { Authorization: JSON.stringify(token) };

  let res1 = await fw.rpc('Users.SetDetails', details, { headers });
  assert.equal(res1.body, '');

  let res2 = await fw.rpc('Users.GetDetails', [uid]);
  assert.deepEqual(res2.json, [details]);
});
