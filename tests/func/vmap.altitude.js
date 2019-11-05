const assert = require('assert');
const fw = require('../fw');

const TSKEY = '01900482';

fw.runTest(async () => {
  u1 = fw.keys(123);

  assert.ok(!await setAlt(u1, -5));
  assert.ok(await setAlt(u1, 0));
  assert.ok(await setAlt(u1, 150));
  assert.ok(!await setAlt(u1, 2e9));

  assert.equal(await getAlt(u1), 150);
});

async function setAlt(user, alt) {
  try {
    await fw.rpc(
      'RSync.AddFile',
      { path: `~/places/${TSKEY}/alt`, data: alt },
      { authz: user });
    return true;
  } catch (err) {
    return false;
  }
}

async function getAlt(user, alt) {
  let res = await fw.rpc(
    'RSync.GetFile',
    { path: `~/places/${TSKEY}/alt` },
    { authz: user });
  return res.json;
}
