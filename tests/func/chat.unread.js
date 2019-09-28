const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let u1 = fw.keys(1);
  let u2 = fw.keys(2);
  let u3 = fw.keys(2);

  let t1 = '2015-01-02-12-30-00';
  let t2 = '2015-01-02-12-31-00';
  let t3 = '2015-01-02-12-30-05';
  let t4 = '2015-01-02-12-35-00';

  for (let u of [u1, u2, u3])
    register(u);

  await sendMessage(u1, u2, 'A', t1);
  await sendMessage(u1, u2, 'B', t2);
  await sendMessage(u3, u2, 'C', t3);

  assert.deepEqual(
    (await getUnreadList(u2)).sort(),
    [u1.uid, u3.uid].sort());

  assert.equal(await getUnreadTime(u2, u1), t2);
  assert.equal(await getUnreadTime(u2, u3), t3);

  await clearUnread(u2, u1);
  assert.deepEqual(await getUnreadList(u2), [u3.uid]);

  await clearUnread(u2, u3);
  assert.deepEqual(await getUnreadList(u2), []);

  await sendMessage(u1, u2, 'D', t4);
  assert.deepEqual(await getUnreadList(u2), [u1.uid]);
});

async function register(u) {
  await fw.rpc('RSync.AddFile', {
    path: '~/profile/pubkey',
    data: u.pubkey,
  }, { authz: u });
}

async function sendMessage(u1, u2, text, time) {
  let r = await fw.rpc('RSync.AddFile', {
    path: `~/chats/${u2.uid}/${time}/text`,
    data: text,
  }, { authz: u1 });
  assert.equal(r.statusCode, 200);
}

async function getUnreadList(u) {
  let r = await fw.rpc('RSync.Dir',
    `~/unread`,
    { authz: u });
  assert.equal(r.statusCode, 200);
  return r.json;
}

async function getUnreadTime(user, from) {
  let r = await fw.rpc('RSync.GetFile',
    `~/unread/${from.uid}`,
    { authz: user });
  assert.equal(r.statusCode, 200);
  return r.json;
}

async function clearUnread(user, from) {
  let r = await fw.rpc('RSync.AddFile',
    { path: `~/unread/${from.uid}`, data: null },
    { authz: user });
  assert.equal(r.statusCode, 200);
}