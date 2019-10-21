const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let u1 = fw.keys(111);
  let u2 = fw.keys(222);

  await fw.rpc('RSync.AddFile', {
    path: `~/reports/${u2.uid}`,
    data: 'Just cause.',
  }, { authz: u1 });

  let res = await fw.rpc('RSync.Dir',
    '~/reports', { authz: u1 });

  assert.deepEqual(res.json, [u2.uid]);
});
