const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let auth1 = fw.keys(123);
  let auth2 = fw.keys(456);
  auth2.uid = auth1.uid;

  let path = '~/profile/name';

  await fw.rpc('RSync.AddFile', {
    path: '~/profile/pubkey',
    data: auth1.pubkey,
  }, { authz: auth1 });

  await fw.rpc('RSync.AddFile', {
    path,
    data: 'Joe',
  }, { authz: auth1 });

  await assert.rejects(
    fw.rpc('RSync.AddFile', { path, data: 'Pwnd' }, { authz: auth2 }),
    { message: 'RPC error: 401 Bad Sig' });
});
