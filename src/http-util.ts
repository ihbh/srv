import * as http from 'http';
import conf from './conf';
import { BadRequest } from './errors';
import rlog from './log';
import { REQUEST_ID } from './http-headers';

const log = rlog.fork('http');

const REQID = /^[a-f0-9]{8}$/;

let rbodies = new WeakMap<http.IncomingMessage, Promise<string>>();
let reqids = new WeakMap<http.IncomingMessage, string>();

export function getRequestId(req: http.IncomingMessage) {
  let id = reqids.get(req);
  if (id) return id;
  id = req.headers[REQUEST_ID.toLowerCase()] + '';
  if (!REQID.test(id))
    id = '';
  if (!id) {
    while (id.length < 8)
      id = id + Math.random().toString(16).slice(2);
    id = id.slice(-8);
  }
  reqids.set(req, id);
  return id;
}

export function downloadRequestBody(req: http.IncomingMessage) {
  let promise = rbodies.get(req);
  if (promise) return promise;

  let body = '';
  let size = 0;
  let aborted = false;
  let maxlen = conf.reqbody.maxlen;

  log.v('Downloading request:', req.url);

  promise = new Promise<string>((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      let n = chunk.length;

      if (size + n > maxlen) {
        aborted = true;
        reject(
          new BadRequest(
            'Request Too Large',
            size + n + ' > ' + maxlen));
      } else {
        body += chunk.toString();
        size += n;
      }
    });
    req.on('end', () => {
      if (!aborted) resolve(body);
    });
  });

  rbodies.set(req, promise);
  return promise;
}