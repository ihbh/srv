const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let uid = '1'.repeat(16);
  let res = await fw.rpc('Users.GetDetails',
    { users: [uid] });
  assert.deepEqual(res.json, [null]);
});
