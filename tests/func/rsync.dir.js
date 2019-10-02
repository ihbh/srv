const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let u1 = fw.keys(123);

  await fw.rpc('RSync.AddFile', {
    path: '~/profile/name',
    data: 'Joe',
  }, { authz: u1 });

  await fw.rpc('RSync.AddFile', {
    path: '~/profile/info',
    data: 'Howdy',
  }, { authz: u1 });

  await test(u1, '/', {
    res: ['vmap', 'users'],
  });

  await test(u1, '/users', {
    res: [u1.uid],
  });

  await test(null, '/vmap', {
    err: 'RPC error: 401 No Access',
  });

  await test(u1, `/users/${u1.uid}`, {
    res: ['profile'],
  });

  await test(u1, `/users/${u1.uid}/profile`, {
    res: ['name', 'info'],
  });

  await test(u1, `/users/${u1.uid}/places`, {
    res: null,
  });

  // anon

  await test(null, '/', {
    res: ['vmap', 'users'],
  });

  await test(null, '/users', {
    res: [],
  });

  await test(null, '/vmap', {
    err: 'RPC error: 401 No Access',
  });

  await test(null, `/users/${u1.uid}`, {
    err: 'RPC error: 401 No Access',
  });

  await test(null, `/users/${u1.uid}/profile`, {
    err: 'RPC error: 401 No Access',
  });

  await test(null, `/users/${u1.uid}/places`, {
    err: 'RPC error: 401 No Access',
  });  
});

async function test(user, path, { res, err }) {
  console.log(path, { err, res });

  try {
    if (err) {
      await assert.rejects(
        fw.rpc('RSync.Dir', path, { authz: user }),
        { message: err });
    } else {
      let { json } = await fw.rpc('RSync.Dir',
        path, { authz: user });
      assert.deepEqual(
        json && json.sort(),
        res && res.sort());
    }
  } catch (e) {
    fw.log(`vfs.dir() for ${path} failed:`, e);
    throw e;
  }
}
