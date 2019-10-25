const assert = require('assert');
const fw = require('../fw');

const TEST_TIMEOUT = 10 * 1000; // ms
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const T_STEP_MIN = 5 * MINUTE;
const T_STEP_MAX = 5 * DAY;
const M = 1e-5; // en.wikipedia.org/wiki/Decimal_degrees#Precision
const GPS_VAR = 150 * M;
const N_USERS = 1000;
const N_LOCATIONS = 100;

let users = [];
let locations = [];

fw.log.cplogs = false;

fw.runTest(async (ct, context) => {
  fw.log.d('Creating locations:', N_LOCATIONS);
  for (let i = 0; i < N_LOCATIONS; i++) {
    let lat = randst(-83, +84, N_LOCATIONS ** 0.5 | 0);
    let lon = randst(-172, +173, N_LOCATIONS ** 0.5 | 0);
    locations.push({ lat, lon });
  }

  fw.log.d('Creating users:', N_USERS);
  let srv = new Server;
  for (let i = 0; i < N_USERS; i++)
    users[i] = new User(srv);

  fw.log.d('Starting users:', users.length);
  for (let u of users)
    u.start(ct);

  await ct.waitForCancellation();
  printStats(srv, context);
}, TEST_TIMEOUT);

function printStats(srv, context) {
  let n = srv.nTotalVisits;
  let s = context.server.getDirSize();

  fw.log.i('Perf results:', [
    // number of visits per second
    'NVs ' + (n / TEST_TIMEOUT).toFixed(1) + ' K',
    // apparent (logical) dir size per visit
    'ASv ' + (s.apparent / n / 1024).toFixed(1) + ' KB',
    // physical (sector) dir size per visit
    'PSv ' + (s.physical / n / 1024).toFixed(1) + ' KB',
  ].join(' | '));
}

function rand(min, max) {
  let p = Math.random();
  return min * (1 - p) + max * p;
}

function randst(min, max, num) {
  let i = Math.round(Math.random() * num);
  let s = (max - min) / num;
  return min + s * i;
}

function randel(array) {
  let i = Math.random() * array.length | 0;
  return array[i];
}

function makeTsKey(tsec) {
  let tskey = (tsec / 60 | 0).toString(16);
  while (tskey.length < 8) tskey = '0' + tskey;
  return tskey;
}

class Server {
  constructor() {
    this.nTotalVisits = 0;
  }

  async shareLocation(authz, timesec, { lat, lon }) {
    let tskey = makeTsKey(timesec);
    let dir = '~/places/' + tskey;
    let res = await fw.rpc('Batch.Run', [
      { name: 'RSync.AddFile', args: { path: dir + '/lat', data: lat } },
      { name: 'RSync.AddFile', args: { path: dir + '/lon', data: lon } },
      { name: 'RSync.AddFile', args: { path: dir + '/time', data: timesec } },
    ], { authz });
    assert.equal(res.statusCode, 200);
    this.nTotalVisits++;
  }

  async getVisitors({ lat, lon }) {
    let res = await fw.rpc('Map.GetVisitors', { lat, lon });
    return Object.keys(res.json);
  }
}

class User {
  constructor(srv) {
    this.srv = srv;
    this.timesec = Date.now() / 1000 | 0;
    this.authz = fw.keys(Math.random());
  }

  async start(ct) {
    while (!ct.cancelled) {
      this.timesec += rand(T_STEP_MIN, T_STEP_MAX);
      let { lat, lon } = this.pickLocation();
      await this.srv.shareLocation(this.authz,
        this.timesec, { lat, lon });
      await this.srv.getVisitors({ lat, lon });
    }
  }

  pickLocation() {
    let { lat, lon } = randel(locations);
    lat += rand(-GPS_VAR, +GPS_VAR);
    lon += rand(-GPS_VAR, +GPS_VAR);
    return { lat, lon };
  }
}
