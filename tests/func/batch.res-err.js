const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let authz = fw.keys(123);
  let { json } = await fw.rpc('Batch.Run', [
    { name: 'Foo.Bar', args: null },
    { name: 'Users.GetDetails', args: { users: [] } },
  ], { authz });
  assert.deepEqual(json, [
    { err: { code: 404 } },
    { res: [] },
  ]);
});
