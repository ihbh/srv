const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let authz = fw.keys(123);
  let path = '~/profile/name';
  let data = 'Joe';

  await fw.rpc(
    'RSync.AddFile',
    { path, data },
    { authz });

  let res = await fw.rpc(
    'RSync.GetFile',
    path,
    { authz });

  assert.equal(res.json, data);
});
