const assert = require('assert');
const http = require('http');
const cu = require('./cu');
const cmd = require('./cmdline');
const { SeqMap } = require('./stat');
const ServerProcess = require('./srvp');
const log = require('./flog');
const CToken = require('./ctoken');

const WAIT_DELAY = 50;
const WAIT_TIMEOUT = 500;
const SRV_PORT = 42817;

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 0x10000,
  maxFreeSockets: 0x10000,
});

let stat = { nreqs: 0 };
let clientRpcT = new SeqMap;
let serverRpcT = new SeqMap;
let srvp = new ServerProcess;

process.on('SIGINT', () => exit(1));

function exit(code = 0) {
  srvp.stop(code);
  process.exit(code);
}

async function runTest(test) {
  try {
    log.d('Waiting for ed25519.wasm');
    await cu.scready;
    await srvp.start();
    let server = srvp;
    let time = Date.now();
    let ct = new CToken('test');
    cmd.timeout && log.i('Timeout:', cmd.timeout, 's');
    let context = { server };
    await Promise.race([
      test(ct, context),
      cmd.timeout && sleep(cmd.timeout * 1000).then(() =>
        ct.cancel('timed out after ' + cmd.timeout + ' s')),
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

async function waitUntil(label, test, timeout = WAIT_TIMEOUT) {
  let time0 = Date.now();
  log.i('Waiting for', label, timeout, 'ms');
  while (Date.now() < time0 + timeout) {
    let res = await test();
    if (res) return;
    await sleep(WAIT_DELAY);
  }
  throw new Error(`waitUntil(${label}) timeout out after ${timeout} ms.`);
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
    agent,
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
    let time0 = Date.now();
    let req = http.request(options, res => {
      let rsp = {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers,
        time: +res.headers['server-time'] || 0,
        body: '',
      };
      res.setEncoding('utf8');
      res.on('data', (data) => rsp.body += data);
      res.on('end', () => {
        stat.nreqs++;
        let delay = Date.now() - time0;
        clientRpcT.get(path).push(delay);
        serverRpcT.get(path).push(rsp.time);

        fetch.logs && log.i('<-', rsp.statusCode,
          rsp.statusMessage);
        fetch.logs && fetch.logbody &&
          log.i(JSON.stringify(rsp.body));

        resolve(rsp);
      });
      res.on('error', (err) => {
        reject(err);
      });
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
  srv: srvp,
  fetch,
  rpcurl,
  waitUntil,
  keys: makeKeys,
  rpc: makerpc,
  stat,
  rpct: clientRpcT,
  srpct: serverRpcT,
};
