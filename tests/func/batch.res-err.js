const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let authz = fw.keys(123);
  let { json } = await fw.rpc('Batch.Run', [
    { name: 'Foo.Bar', args: null },
    { name: 'RSync.GetFile', args: { path: '~/profile/name' } },
  ], { authz });
  assert.deepEqual(json, [
    { err: { code: 404, status: 'Bad RPC', description: '' } },
    { res: null },
  ]);
});
