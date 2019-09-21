const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let uid = '1'.repeat(16);
  let res = await fw.rpc('RSync.GetFile',
    '/users/' + uid + '/profile/name');
  assert.deepEqual(res.json, null);
});
