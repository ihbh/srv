const assert = require('assert');
const fw = require('../fw');

fw.fetch.logs = true;

fw.runTest(async () => {
  let res = await fw.fetch('GET', '/');
  assert.equal(res.body, 'You have reached IHBH.');
});
