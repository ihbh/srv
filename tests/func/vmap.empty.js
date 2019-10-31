const assert = require('assert');
const fw = require('../fw');

const GPS_1 = [51.5073, -0.1277]; // London

fw.runTest(async () => {
  let [lat, lon] = GPS_1;
  let res = await fw.rpc('Map.GetVisitors', { lat, lon });
  let uids = new Set(Object.keys(res.json));
  assert.deepEqual([...uids], []);
});
