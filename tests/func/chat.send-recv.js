const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let u1 = fw.keys(1);
  let u2 = fw.keys(2);

  let time = new Date().toJSON()
    .replace(/[^\d]/g, '-')
    .slice(0, 19);

  for (let u of [u1, u2]) {
    await fw.rpc('RSync.AddFile', {
      path: '~/profile/pubkey',
      data: u.pubkey,
    }, { authz: u });
  }

  let res1 = await fw.rpc('RSync.AddFile', {
    path: `~/chats/${u2.uid}/${time}/text`,
    data: `Howdy, ${u2.uid}`,
  }, { authz: u1 });

  assert.equal(res1.statusCode, 200);

  let res2 = await fw.rpc('RSync.GetFile',
    { path: `/users/${u1.uid}/chats/${u2.uid}/${time}/text` },
    { authz: u2 });

  assert.equal(res2.json, `Howdy, ${u2.uid}`);

  let res3 = await fw.rpc('RSync.Dir',
    `/users/${u1.uid}/chats/${u2.uid}`,
    { authz: u2 });

  assert.deepEqual(res3.json, [time]);
});
