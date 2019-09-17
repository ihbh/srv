const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let authz = fw.keys(123);
  let path = '~/../foobar';
  let data = 'Joe';

  await assert.rejects(
    fw.rpc('RSync.AddFile', { path, data }, { authz }),
    { message: 'RPC error: 400 Bad JSON' });

  await assert.rejects(
    fw.rpc('RSync.GetFile', path, { authz }),
    { message: 'RPC error: 400 Bad JSON' });
});
