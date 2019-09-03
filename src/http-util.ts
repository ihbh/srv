import * as http from 'http';
import conf from './conf';
import { BadRequest } from './errors';
import { log } from './log';

let rbodies = new WeakMap<
  http.IncomingMessage, Promise<string>>();

export function downloadRequestBody(req: http.IncomingMessage) {
  let promise = rbodies.get(req);
  if (promise) {
    log.v('Request already downloaded:', req.url);
    return promise;
  }

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
        reject(new BadRequest('Request Too Large'));
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