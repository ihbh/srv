const assert = require('assert');
const fw = require('../fw');
const { sha256 } = require('../cu');

fw.runTest(async () => {
  let authz = fw.keys(123);
  let path = '~/profile/name';
  let data = 'Joe';
  let hash = sha256(JSON.stringify(data)).slice(0, 6);

  await fw.rpc(
    'RSync.AddFile',
    { path, data },
    { authz });

  let res = await fw.rpc(
    'RSync.GetFile',
    { path, hash },
    { authz });

  assert.equal(res.json, null);

  let res2 = await fw.rpc(
    'RSync.GetFile',
    { path, hash: '123456' },
    { authz });

  assert.equal(res2.json, data);  
});
