const cp = require('child_process');
const fs = require('fs');
const assert = require('assert');
const http = require('http');
const mkdirp = require('mkdirp');
const cu = require('./cu');

const BIN_PATH = 'bin/index';
const CONF_PATH = './conf.json';
const SRV_PORT = 3921;
const WAIT_MESSAGE = 'Listening on port';

let srv = {};
srv.procs = {};

srv.start = async () => {
  log.i('Starting the server.');

  let srvdir = '/tmp/ihbh/' + Date.now();
  let confpath2 = srvdir + '/conf.json';
  let conf = JSON.parse(fs.readFileSync(CONF_PATH));
  conf.dirs.base = srvdir;
  mkdirp.sync(srvdir);
  fs.writeFileSync(confpath2, JSON.stringify(conf), 'utf8');

  let srvp = cp.spawn('node', [
    BIN_PATH,
    '--config', confpath2,
    '--verbose',
  ]);

  srv.procs[srvp.pid] = srvp;

  srvp.stdout.on('data', (data) => log.cp(srvp.pid, data + ''));
  srvp.stderr.on('data', (data) => log.cp(srvp.pid, data + ''));

  await log.waitFor(WAIT_MESSAGE, srvp.pid);
};

srv.stop = () => {
  log.i('Stopping the server.');
  for (let pid in srv.procs)
    srv.procs[pid].kill();
  srv.procs = {};
};

process.on('SIGINT', () => exit(1));

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
  for (let regex of log.cp.excluded)
    if (regex.test(line))
      return true;
  return false;
}

log.cp.excluded = [];

log.waitFor = (pattern, pid) => new Promise(resolve => {
  log.i('Waiting for the srv log:', JSON.stringify(pattern));
  log.listeners.push(function listener(line = '', srvpid) {
    if (pid && pid != srvpid) return;
    if (line.indexOf(pattern) < 0) return;
    log.i('Detected the srv log:', JSON.stringify(pattern));
    let i = log.listeners.indexOf(listener);
    log.listeners.splice(i, 1);
    resolve(line);
  });
});

async function runTest(test) {
  try {
    log.i('Waiting for scready.');
    await cu.scready;
    await srv.start();
    let time = Date.now();
    await test();
    log.i(Date.now() - time, 'ms');
    log.i('Test passed.');
    exit(0);
  } catch (err) {
    log.i('Test failed:', err);
    exit(1);
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

module.exports = {
  runTest,
  log,
  srv,
  fetch,
  rpcurl,
  rpc: makerpc,
};
