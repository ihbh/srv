const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let authz = fw.keys(123);
  let { json } = await fw.rpc('Batch.Run', [], { authz });
  assert.deepEqual(json, []);
});
