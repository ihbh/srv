const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let u1 = fw.keys(1);
  let u2 = fw.keys(2);

  await register(u1);
  await register(u2);

  let lat = 12.3456;
  let lon = 98.7654;
  let time = new Date('2020-01-01').getTime() / 1000 / 60 | 0;

  await visit(u1, time, { lat, lon });
  await visit(u2, time, { lat, lon });
  await checkVisitors({ lat, lon }, [u1.uid, u2.uid]);

  await unvisit(u1, time);
  await checkVisitors({ lat, lon }, [u2.uid]);

  await unvisit(u2, time);
  await checkVisitors({ lat, lon }, []);
});

async function checkVisitors({ lat, lon }, uids) {
  await fw.waitUntil(`visitors = ${uids.length}`, async () => {
    let res = await fw.rpc('Map.GetVisitors',
      { lat, lon });
    let uids2 = Object.keys(res.json).sort().join(',');
    return uids2 == uids.sort().join(',');
  });
}

async function visit(user, time, { lat, lon }) {
  let tskey = '0' + time.toString(16);
  let props = { lat, lon, time: time * 60 };
  let args = Object.keys(props).map(prop => {
    return {
      name: 'RSync.AddFile',
      args: {
        path: `~/places/${tskey}/${prop}`,
        data: props[prop]
      }
    };
  });
  await fw.rpc('Batch.Run',
    args, { authz: user });
}

async function unvisit(user, time) {
  let tskey = '0' + time.toString(16);
  let props = ['lat', 'lon', 'time'];
  let dir = `~/places/${tskey}`;
  let args = props.map(prop => {
    return {
      name: 'RSync.DeleteFile',
      args: {
        path: `${dir}/${prop}`,
        data: props[prop]
      }
    };
  });

  await fw.rpc('Batch.Run',
    args, { authz: user });

  await fw.waitUntil(`${dir} = empty`, async () => {
    let rdirs = await fw.rpc('RSync.Dir',
      `${dir}`, { authz: user });
    fw.log.i(`dir ${dir} = ${rdirs.json.length}`);
    return rdirs.json.length === 0;
  });
}

async function register(user) {
  await fw.rpc('RSync.AddFile', {
    path: '~/profile/pubkey',
    data: user.pubkey,
  }, { authz: user });
}
