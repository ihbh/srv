const assert = require('assert');
const fw = require('../fw');

fw.fetch.logs = true;

let authz;

fw.runTest(async () => {
  authz = fw.keys(123);

  await updateName('Joe1');
  await updateName('Joe2');
});

async function updateName(name) {
  let photo = 'data:image/jpeg;base64,qwerty';
  let info = 'Howdy, I\'m Joe.';
  let { uid, pubkey } = authz;

  let res1 = await fw.rpc('Batch.Run', [
    { name: 'RSync.AddFile', args: { path: '~/profile/pubkey', data: pubkey } },
    { name: 'RSync.AddFile', args: { path: '~/profile/name', data: name } },
    { name: 'RSync.AddFile', args: { path: '~/profile/photo', data: photo } },
    { name: 'RSync.AddFile', args: { path: '~/profile/info', data: info } },
  ], { authz });

  assert.deepEqual(res1.json, [
    {}, {}, {}, {},
  ]);

  let res2 = await fw.rpc('Batch.Run', [
    { name: 'RSync.GetFile', args: `/users/${uid}/profile/pubkey` },
    { name: 'RSync.GetFile', args: `/users/${uid}/profile/name` },
    { name: 'RSync.GetFile', args: `/users/${uid}/profile/photo` },
    { name: 'RSync.GetFile', args: `/users/${uid}/profile/info` },
  ]);

  assert.deepEqual(res2.json, [
    { res: pubkey },
    { res: name },
    { res: photo },
    { res: info },
  ]);
}
