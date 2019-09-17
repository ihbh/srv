import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import * as zlib from 'zlib';
import * as fs from 'fs';
import * as cmdargs from 'commander';

import conf, { initConfig, CONF_JSON } from './conf';
import { log } from './log';

log('>', process.argv.join(' '));

cmdargs
  .option('-c, --config <s>', 'JSON config.', CONF_JSON)
  .option('-v, --verbose', 'Verbose logging.')
  .parse(process.argv);

log.verbose = cmdargs.verbose || false;
log.i('Verbose logging?', log.verbose);

initConfig(cmdargs.config);

import { HttpError } from './errors';
import { executeHandler } from './handlers/http-handler';
import * as qps from './qps';

import './handlers/cors-preflight';
import './handlers/stats-qps';
import './handlers/users';
import './handlers/rsync';
import './handlers/map';
import './handlers/root';

const CERT_DIR = '/etc/letsencrypt/live/ihbh.org/';
const CERT_KEY_FILE = 'privkey.pem';
const CERT_FILE = 'cert.pem';

let nAllRequests = qps.register('http.all-requests', 'qps');
let statGZipCount = qps.register('http.gzip.count', 'qps');
let statGZipTime = qps.register('http.gzip.time', 'avg');

if (conf.gzip.size > 0) {
  log.i('Min gzip response size:',
    (conf.gzip.size / 1024).toFixed(1), 'KB');
} else {
  log.i('GZip disabled.');
}

async function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  let htime = Date.now();
  log.v(req.method, req.url);
  nAllRequests.add();
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    let rsp = await executeHandler(req);

    if (!rsp) {
      rsp = {
        statusCode: 400,
        statusMessage: 'Unhandled request',
      };
    }

    let useGZip = typeof rsp.body == 'string' &&
      conf.gzip.size > 0 && rsp.body.length >= conf.gzip.size;

    if (useGZip) {
      statGZipCount.add();
      let gtime = Date.now();
      let gzipped = await gzipText(rsp.body as string);
      gtime = Date.now() - gtime;
      statGZipTime.add(gtime);
      log.i('gzip time:', gtime, 'ms');
      rsp.body = gzipped;
      rsp.headers = {
        ...rsp.headers,
        'Content-Encoding': 'gzip',
      };
    }

    for (let name in rsp.headers || {}) {
      res.setHeader(name, rsp.headers[name]);
    }

    if (rsp.text) {
      res.setHeader('Content-Type', 'text/plain');
      res.write(rsp.text);
    } else if (rsp.json) {
      res.setHeader('Content-Type', 'application/json');
      res.write(JSON.stringify(rsp.json));
    } else if (rsp.html) {
      res.setHeader('Content-Type', 'text/html');
      res.write(rsp.html);
    } else if (rsp.body) {
      res.write(rsp.body);
    }

    res.statusCode = rsp.statusCode || 200;
    res.statusMessage = rsp.statusMessage || '';
  } catch (err) {
    if (err instanceof HttpError) {
      log.w(err.message);
      res.statusCode = err.code;
      res.statusMessage = err.status;
      res.write(err.description);
    } else {
      log.e(err);
      res.statusCode = 500;
    }
  } finally {
    res.end();
    log.v('HTTP', res.statusCode, 'in', Date.now() - htime, 'ms');
  }
}

function gzipText(text: string) {
  return new Promise<Buffer>((resolve, reject) => {
    zlib.gzip(text, (err, buf) => {
      if (err) {
        reject(err);
      } else {
        resolve(buf);
      }
    });
  });
}

function createServer() {
  log.i('Checking the cert dir:', CERT_DIR);
  if (fs.existsSync(CERT_DIR)) {
    log.i('Starting HTTPS server.');
    let key = fs.readFileSync(path.join(CERT_DIR, CERT_KEY_FILE));
    let cert = fs.readFileSync(path.join(CERT_DIR, CERT_FILE));
    return https.createServer({ key, cert }, handleHttpRequest);
  } else {
    log.w('SSL certs not found.');
    log.i('Starting HTTP server.');
    return http.createServer(handleHttpRequest);
  }
}

let server = createServer();
server.listen(conf.port);
server.on('error', err => log.e(err));
server.on('listening', () => log.i('Listening on port', conf.port));
