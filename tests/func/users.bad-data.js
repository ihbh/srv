const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let authz = fw.keys(123);

  await assert.rejects(
    fw.rpc('RSync.GetFile',
      { path: '/foo/bar' },
      { authz }),
    { message: 'RPC error: 401 No Access' });

  await assert.rejects(
    fw.rpc('RSync.GetFile',
      { path: '/users/123/profile/name' },
      { authz }),
    { message: 'RPC error: 400 Bad Path' });

  await assert.rejects(
    fw.rpc('RSync.AddFile',
      { path: '~/prof/name', data: 'Joe' },
      { authz }),
    { message: 'RPC error: 400 Bad Data' });

  await assert.rejects(
    fw.rpc('RSync.GetFile',
      { path: '/users'.repeat(2e3 / 6 | 0) },
      { authz }),
    { message: 'RPC error: 400 Bad JSON' });

  await assert.rejects(
    fw.rpc('RSync.AddFile',
      { path: '~/profile/name', data: 'Joe'.repeat(10) },
      { authz }),
    { message: 'RPC error: 400 Bad Data' });

  await assert.rejects(
    fw.rpc('RSync.AddFile',
      { path: '~/profile/pubkey', data: '5'.repeat(63) },
      { authz }),
    { message: 'RPC error: 400 Bad Data' });
});
