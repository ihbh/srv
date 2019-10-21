const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let u1 = fw.keys(111);
  let ts = '2010-10-20-23-34-45';

  await fw.rpc('RSync.AddFile', {
    path: `~/feedbacks/${ts}`,
    data: 'Howdy',
  }, { authz: u1 });

  let res = await fw.rpc('RSync.Dir',
    '~/feedbacks', { authz: u1 });

  assert.deepEqual(res.json, [ts]);
});
