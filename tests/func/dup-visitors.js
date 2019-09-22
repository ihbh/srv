const assert = require('assert');
const fw = require('../fw');

fw.runTest(async () => {
  let u1 = fw.keys(1);
  let u2 = fw.keys(2);

  let lat = 43;
  let lon = 67;
  let time = new Date('2020-01-01').getTime() / 1000 / 60 | 0;

  await visit(u1, time + 1, { lat, lon });
  await visit(u2, time + 2, { lat, lon });
  await visit(u1, time + 3, { lat, lon });
  await visit(u2, time + 4, { lat, lon });
  await visit(u1, time + 5, { lat, lon });

  let res = await fw.rpc('Map.GetVisitors',
    { lat, lon });

  assert.deepEqual(
    Object.keys(res.json).sort(),
    [u1.uid, u2.uid].sort());
});

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
