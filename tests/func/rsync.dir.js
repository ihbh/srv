const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let authz = fw.keys(123);

  await fw.rpc('RSync.AddFile', {
    path: '~/profile/name',
    data: 'Joe',
  }, { authz });

  await fw.rpc('RSync.AddFile', {
    path: '~/profile/info',
    data: 'Howdy',
  }, { authz });

  let res = await fw.rpc('RSync.Dir',
    '~/profile', { authz });

  assert.deepEqual(res.json.sort(), [
    'name',
    'info',
  ].sort());

  let res2 = await fw.rpc('RSync.Dir',
    '~/profile/places', { authz });

  assert.equal(res2.json, null);
  assert.equal(res2.statusCode, 200);

  await assert.rejects(
    fw.rpc('RSync.Dir', '/users', { authz }),
    { message: 'RPC error: 401 No Access' });
});
