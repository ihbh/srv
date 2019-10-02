const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let u1 = fw.keys(123); // u1 = the good user
  let u2 = fw.keys(456); // u2 pretends to be u1
  let u3 = fw.keys(456); // u3 = the bad user

  u2.uid = u1.uid;

  let path = '~/profile/name';

  await fw.rpc('RSync.AddFile', {
    path: '~/profile/pubkey',
    data: u1.pubkey,
  }, { authz: u1 });

  await fw.rpc('RSync.AddFile', {
    path: '~/profile/pubkey',
    data: u3.pubkey,
  }, { authz: u3 });

  await fw.rpc('RSync.AddFile', {
    path,
    data: 'Joe',
  }, { authz: u1 });

  await assert.rejects(
    fw.rpc('RSync.AddFile', {
      path,
      data: 'Pwnd'
    }, { authz: u2 }),
    { message: 'RPC error: 401 Bad Sig' });

  await assert.rejects(
    fw.rpc('RSync.AddFile', {
      path: path.replace('~', '/users/' + '1'.repeat(16)),
      data: 'Pwnd'
    }, { authz: u1 }),
    { message: 'RPC error: 401 No Access' });

  await assert.rejects(
    fw.rpc('RSync.DeleteFile', {
      path: `/users/${u1.uid}/profile/name`,
    }, { authz: u3 }),
    { message: 'RPC error: 401 No Access' });

  await assert.rejects(
    fw.rpc('RSync.DeleteFile', {
      path: `/users/${u1.uid}`,
    }, { authz: u3 }),
    { message: 'RPC error: 401 No Access' });

  await assert.rejects(
    fw.rpc('RSync.DeleteFile', {
      path: `/users/${u1.uid}/profile/name`,
    }),
    { message: 'RPC error: 401 Bad Sig' });

  await assert.rejects(
    fw.rpc('RSync.DeleteFile', {
      path: `/vmap/12345`,
    }, { authz: u3 }),
    { message: 'RPC error: 401 No Access' });
});
