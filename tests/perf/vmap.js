const assert = require('assert');
const fw = require('../fw');

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const T_STEP_MIN = 5 * MINUTE;
const T_STEP_MAX = 5 * DAY;
const M = 1e-5; // en.wikipedia.org/wiki/Decimal_degrees#Precision
const GPS_VAR = 150 * M;
const N_USERS = 1000;
const N_LOCATIONS = 100;
const VISIT_DELAY = 50; // ms

let users = [];
let locations = [];

fw.runTest(async (ct, context) => {
  context.server.watchOpenFiles();
  let srv = new Server;

  fw.log.i('Creating locations:', N_LOCATIONS);
  for (let i = 0; i < N_LOCATIONS; i++) {
    let lat = randst(-83, +84, N_LOCATIONS ** 0.5 | 0);
    let lon = randst(-172, +173, N_LOCATIONS ** 0.5 | 0);
    locations.push({ lat, lon });
  }

  fw.log.i('Creating users:', N_USERS);
  for (let i = 0; i < N_USERS; i++)
    users[i] = new User(srv);

  let mem0 = context.server.getMemSize();
  let time0 = Date.now();
  fw.log.i('Mem size:', mem0 / 1e3, 'MB');

  fw.log.i('Starting the users.');
  for (let u of users)
    u.start(ct);

  await ct.waitForCancellation();
  fw.log.i('Max requests:', srv.nMaxRequests);
  fw.log.i('Visits:', srv.nTotalVisits / 1e3, 'K');
  let mem1 = context.server.getMemSize();
  let tdiff = Date.now() - time0;
  fw.log.i('Mem size:', mem1 / 1e3, 'MB');
  fw.log.i('QPS:', (fw.stat.nreqs / tdiff).toFixed(1), 'K');
  printStats(srv, context, mem1 - mem0, tdiff);
  printRpcDelays();
});

function printRpcDelays() {
  for (let [url, seq] of fw.rpct) {
    let ct = seq.mean.toFixed(1);
    let st = fw.srpct.get(url).mean.toFixed(1);
    fw.log.i('Delay for', url,
      'x', seq.size, `C:${ct} ms`, `S:${st} ms`);
  }
}

function printStats(srv, context, msize, dtime) {
  let count = srv.nTotalVisits;
  let dsize = context.server.getDirSize();
  fw.log.i('Max open files:', context.server.maxOpenFiles);
  // number of visits in K per second
  fw.log.i('Perf:', (count / dtime).toFixed(1), 'Kv/s');
  // allocated memory size in KB per visit
  fw.log.i('Memory:', (msize / count).toFixed(1), 'KB/v');
  // physical (sector) dir size in KB per visit
  fw.log.i('Disk:', (dsize.physical / count / 1024).toFixed(1), 'KB/v');
  // apparent (logical) dir size in KB per visit
  fw.log.i('VFS', (dsize.apparent / count / 1024).toFixed(1), 'KB/v');

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
    this.tServerTime = 0;
    this.nRequests = 0;
    this.nMaxRequests = 0;
  }

  async shareLocation(authz, timesec, { lat, lon }) {
    let tskey = makeTsKey(timesec);
    let dir = '~/places/' + tskey;
    this.nMaxRequests = Math.max(
      this.nMaxRequests,
      ++this.nRequests);
    let res = await fw.rpc('Batch.Run', [
      { name: 'RSync.AddFile', args: { path: dir + '/lat', data: lat } },
      { name: 'RSync.AddFile', args: { path: dir + '/lon', data: lon } },
      { name: 'RSync.AddFile', args: { path: dir + '/time', data: timesec | 0 } },
    ], { authz });
    this.nRequests--;
    this.nTotalVisits++;
    this.tServerTime += res.time;
  }

  async getVisitors({ lat, lon }) {
    this.nMaxRequests = Math.max(
      this.nMaxRequests,
      ++this.nRequests);
    let res = await fw.rpc('Map.GetVisitors', { lat, lon });
    this.nRequests--;
    this.tServerTime += res.time;
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
      await fw.sleep(VISIT_DELAY);
      this.timesec += rand(T_STEP_MIN, T_STEP_MAX);
      let { lat, lon } = this.pickLocation();
      await this.srv.shareLocation(this.authz,
        this.timesec, { lat, lon });
      await fw.sleep(VISIT_DELAY);
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
