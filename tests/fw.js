const cp = require('child_process');
const fs = require('fs');
const assert = require('assert');
const http = require('http');
const mkdirp = require('mkdirp');
const cu = require('./cu');
const cmd = require('./cmdline');

const BIN_PATH = 'bin/index';
const CONF_PATH = './conf.json';
const SRV_PORT = 42817;
const CPU_PROF_FILE = /^isolate-/;
const WAIT_MESSAGE = 'Listening on port';

let srv = {};
srv.procs = {};

srv.start = async () => {
  let runid = new Date().toJSON()
    .replace('T', '/')
    .replace(/:/g, '-')
    .replace(/Z$/, '');
  let srvdir = '/tmp/ihbh/' + runid;
  let confpath2 = srvdir + '/conf.json';
  log.i('Starting the server:', srvdir);
  let conf = JSON.parse(fs.readFileSync(CONF_PATH));
  conf.port = SRV_PORT;
  conf.dirs.base = srvdir;
  mkdirp.sync(srvdir);
  fs.writeFileSync(confpath2, JSON.stringify(conf), 'utf8');

  try {
    log.d('Removing listeners on port', SRV_PORT);
    cp.execSync(`fuser -kvs ${SRV_PORT}/tcp`);
  } catch { }

  let srvp = cp.spawn('node', [
    ...(cmd.profile ? ['--prof'] : []),
    BIN_PATH,
    '--config', confpath2,
    cmd.verbose && '--verbose',
  ].filter(arg => !!arg));

  let handler = {
    proc: srvp,
    dir: srvdir,
    killProc: () => killProc(srvp, srvdir),
    getDirSize: () => getDirSize(srvdir),
    getMemSize: () => getMemSize(srvp.pid),
  };

  srv.procs[srvp.pid] = handler;

  srvp.stdout.on('data', (data) => log.cp(srvp.pid, data + ''));
  srvp.stderr.on('data', (data) => log.cp(srvp.pid, data + ''));

  await log.waitFor(WAIT_MESSAGE, srvp.pid);
  return handler;
};

srv.stop = () => {
  log.i('Stopping the server.');
  for (let pid in srv.procs)
    srv.procs[pid].killProc();
  srv.procs = {};
};

process.on('SIGINT', () => exit(1));

function killProc(p, dir) {
  p.kill();

  if (cmd.profile) {
    log.d('Post-processing CPU profiler log.');
    let pdir = dir + '/prof';
    mkdirp.sync(pdir);
    let fnames = fs.readdirSync('.')
      .filter(name => CPU_PROF_FILE.test(name));
    for (let fname of fnames) {
      fs.renameSync('./' + fname, pdir + '/' + fname);
      let sname = `${fname}.summary.log`;
      cp.execSync(`(cd ${pdir}; node --prof-process ${fname} > ${sname})`);
      log.i('CPU profiler summary:', pdir + '/' + sname);
    }
  }
}

function getDirSize(dirpath) {
  let sap = cp.execSync('du -sB1 ' + dirpath) + '';
  let sph = cp.execSync('du -sb ' + dirpath) + '';
  let apparent = +sph.split('\t')[0];
  let physical = +sap.split('\t')[0];
  return { apparent, physical };
}

function getMemSize(pid) {
  let s = cp.execSync(`ps -q ${pid} -o size`) + '';
  let m = /\d+/.exec(s);
  return +m[0];
}

function exit(code = 0) {
  srv.stop();
  process.exit(code);
}

function log(...args) {
  console.log(...args);
}

log.i = (...args) => log('I', ...args);
log.d = (...args) => log('D', ...args);

log.listeners = [];

log.cp = (pid, text) => {
  let lines = text.split(/\r?\n/g);

  for (let line of lines) {
    line = line.trimRight();
    if (!line) continue;

    if (!isLogExcluded(line))
      log(pid + ' :: ' + line);

    for (let listener of log.listeners)
      listener(line, pid);
  }
};

function isLogExcluded(line) {
  if (!log.cplogs)
    return true;
  for (let regex of log.cp.excluded)
    if (regex.test(line))
      return true;
  return false;
}

log.cplogs = true;
log.cp.excluded = [];

log.waitFor = (pattern, pid) => new Promise(resolve => {
  log.d('Waiting for the srv log:', JSON.stringify(pattern));
  log.listeners.push(function listener(line = '', srvpid) {
    if (pid && pid != srvpid) return;
    if (line.indexOf(pattern) < 0) return;
    log.d('Detected the srv log:', JSON.stringify(pattern));
    let i = log.listeners.indexOf(listener);
    log.listeners.splice(i, 1);
    resolve(line);
  });
});

async function runTest(test) {
  try {
    log.d('Waiting for ed25519.wasm');
    await cu.scready;
    let server = await srv.start();
    let time = Date.now();
    let ct = new CToken('test');
    cmd.timeout && log.i('Timeout:', cmd.timeout, 's');
    let context = { server };
    await Promise.race([
      test(ct, context),
      cmd.timeout && sleep(cmd.timeout * 1000).then(() =>
        ct.cancel('timed out after ' + cmd.timeout + ' ms')),
    ]);
    log.i(Date.now() - time, 'ms');
    log.i('Test passed.');
    exit(0);
  } catch (err) {
    log.i('Test failed:', err);
    exit(1);
  }
}

function sleep(dt) {
  return new Promise(
    resolve => setTimeout(resolve, dt));
}

class CToken {
  constructor(name) {
    this.name = name;
    this.cancelled = false;
    this.whenCancelled = new Promise(
      resolve => this.resolveWhenCancelled = resolve);
  }

  cancel(reason) {
    log.i(this.name, 'cancelled:', reason);
    this.cancelled = true;
    this.resolveWhenCancelled();
  }

  waitForCancellation() {
    return this.whenCancelled;
  }
}

function fetch(method, path, { body, json, authz, headers = {} } = {}) {
  if (json) {
    body = JSON.stringify(json);
    headers['Content-Type'] = 'application/json';
  }

  let options = {
    host: '127.0.0.1',
    port: SRV_PORT,
    path: path,
    method: method,
    headers: {
      'Content-Length': body ? Buffer.byteLength(body) : 0,
      ...headers,
    }
  };

  if (authz) {
    let signed = path + '\n' + body;
    let sig = cu.sign(signed, authz.pubkey, authz.privkey);
    assert(
      cu.verify(sig, signed, authz.pubkey),
      'The created signature is invalid.');
    let token = { uid: authz.uid, sig };
    options.headers['Authorization'] = JSON.stringify(token);
  }

  return new Promise((resolve, reject) => {
    let req = http.request(options, res => {
      let rsp = {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers,
        body: '',
      };
      res.setEncoding('utf8');
      res.on('data', (data) => rsp.body += data);
      res.on('end', () => {
        fetch.logs && log.i('<-', rsp.statusCode,
          rsp.statusMessage);
        fetch.logs && fetch.logbody &&
          log.i(JSON.stringify(rsp.body));
        resolve(rsp);
      });
      res.on('error', reject);
    });

    if (body) req.write(body);
    req.end();
    fetch.logs && log.i('->', method, path);
    fetch.logs && fetch.logbody &&
      log.i(JSON.stringify(body));
  });
}

fetch.logs = false;
fetch.logbody = false;

function rpcurl(method) {
  return '/rpc/' + method;
}

function makerpc(method, args, extras) {
  return fetch('POST', '/rpc/' + method, {
    json: args,
    ...extras
  }).then(res => {
    if (res.statusCode != 200)
      throw new Error('RPC error: ' + res.statusCode + ' ' + res.statusMessage);

    try {
      if (res.body)
        res.json = JSON.parse(res.body);
    } catch (err) {
      throw new Error('Bad RPC response: ' + err.message);
    }

    return res;
  });
}

function makeKeys(id) {
  let uid = cu.sha256('u' + id).slice(0, 16);
  let seed = cu.sha256('k' + id);
  let [pubkey, privkey] = cu.keypair(seed);
  return { uid, seed, pubkey, privkey };
}

log.i('Cmd line args:', cmd);
if (!cmd.profile)
  log.i('Add --profile to enable CPU profiling.');

module.exports = {
  runTest,
  sleep,
  log,
  srv,
  fetch,
  rpcurl,
  keys: makeKeys,
  rpc: makerpc,
};
