import * as https from 'https';
import * as http from 'http';
import * as path from 'path';
import * as zlib from 'zlib';
import * as fs from 'fs';
import * as cmdargs from 'commander';

import conf, { initConfig, CONF_JSON } from './conf';
import rlog, { config as logconf } from './log';
import { REQUEST_ID, CORS_ORIGIN, CONTENT_TYPE, CONTENT_ENCODING } from './http-headers';
import { getRequestId } from './http-util';

const log = rlog.fork('http');

log.i('>', process.argv.join(' '));

cmdargs
  .option('-c, --config <s>', 'JSON config.', CONF_JSON)
  .option('-v, --verbose', 'Verbose logging.')
  .parse(process.argv);

logconf.verbose = cmdargs.verbose || false;
log.i('Verbose logging?', logconf.verbose);

initConfig(cmdargs.config);

import { HttpError } from './errors';
import { executeHandler } from './http-handler';
import * as qps from './qps';

importAll('handlers');
importAll('', name => name.startsWith('vfs-'));

let nAllRequests = qps.register('http.all-requests', 'qps');
let statGZipCount = qps.register('http.gzip.count', 'qps');
let statGZipTime = qps.register('http.gzip.time', 'avg');

if (conf.gzip.size > 0) {
  log.i('Min gzip response size:',
    (conf.gzip.size / 1024).toFixed(1), 'KB');
} else {
  log.i('GZip disabled.');
}

function importAll(subdir: string, test?: (name: string) => boolean) {
  let hdir = path.join(__dirname, subdir);
  for (let name of fs.readdirSync(hdir))
    if (name.endsWith('.js') && (!test || test(name)))
      require(path.join(hdir, name));
}

async function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  let htime = Date.now();
  res.setHeader(CORS_ORIGIN, '*');
  let reqid = '[' + getRequestId(req) + ']';
  log.i(reqid, req.method, req.url);
  nAllRequests.add();

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
      log.v(reqid, 'gzip time:', gtime, 'ms');
      rsp.body = gzipped;
      rsp.headers = {
        ...rsp.headers,
        [CONTENT_ENCODING]: 'gzip',
      };
    }

    for (let name in rsp.headers || {}) {
      res.setHeader(name, rsp.headers[name]);
    }

    if (rsp.text) {
      res.setHeader(CONTENT_TYPE, 'text/plain');
      res.write(rsp.text);
    } else if (rsp.json) {
      res.setHeader(CONTENT_TYPE, 'application/json');
      res.write(JSON.stringify(rsp.json));
    } else if (rsp.html) {
      res.setHeader(CONTENT_TYPE, 'text/html');
      res.write(rsp.html);
    } else if (rsp.body) {
      res.write(rsp.body);
    }

    res.statusCode = rsp.statusCode || 200;
    res.statusMessage = rsp.statusMessage || '';
  } catch (err) {
    if (err instanceof HttpError) {
      log.w(reqid, err.message);
      res.statusCode = err.code;
      res.statusMessage = err.status;
      res.write(err.description);
    } else {
      log.e(reqid, err);
      res.statusCode = 500;
    }
  } finally {
    res.end();
    log.i(reqid, 'HTTP', res.statusCode, 'in', Date.now() - htime, 'ms');
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
  log.i('Checking the cert dir:', conf.cert.dir);
  if (fs.existsSync(conf.cert.dir)) {
    log.i('Starting HTTPS server.');
    let key = fs.readFileSync(path.join(conf.cert.dir, conf.cert.keyfile));
    let cert = fs.readFileSync(path.join(conf.cert.dir, conf.cert.certfile));
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
