import { IncomingMessage } from 'http';
import { PUBKEY_PATH, VFS_USERS_DIR } from './conf';
import { BadRequest, Unauthorized } from './errors';
import { AUTHORIZATION } from './http-headers';
import { downloadRequestBody } from './http-util';
import rlog from './log';
import * as rpc from './rpc';
import * as rttv from './rttv';
import * as ed25519 from './ed25519';
import * as vfs from './vfs';

const log = rlog.fork('auth');

const tAuthToken = rttv.dict({
  uid: rttv.uid,
  sig: rttv.opt(rttv.signature),
});

const cache = new WeakMap<IncomingMessage, Promise<typeof rttv.uid.input>>();

export function RequiredUserId() {
  return rpc.ParamDep('RequiredUserId', async ctx => {
    let uid = await getUserId(ctx.req);
    if (!uid) throw new Unauthorized('Bad Sig');
    return uid;
  });
}

export function OptionalUserId() {
  return rpc.ParamDep('OptionalUserId', async ctx => {
    let uid = await getUserId(ctx.req);
    return uid || null;
  });
}

async function getUserId(req: IncomingMessage) {
  let p = cache.get(req);
  if (p) return p;
  p = getUserIdInternal(req);
  cache.set(req, p);
  return p;
}

async function getUserIdInternal(req: IncomingMessage) {
  let ts = Date.now();
  let token = req.headers[AUTHORIZATION.toLowerCase()] as string;
  if (!token) {
    log.v(`No ${AUTHORIZATION} header.`);
    return null;
  }
  
  let { uid, sig } = parseAuthToken(token);
  let pkpath = PUBKEY_PATH.replace('~', VFS_USERS_DIR + '/' + uid);
  let pubkey = await vfs.root.get(pkpath);

  if (!pubkey) {
    log.v('No pubkey for', uid, Date.now() - ts, 'ms');
    // This means that until <uid> sets pubkey,
    // anyone can impersonate that <uid>.
    return uid;
  }

  if (!await verifySignature(req, pubkey, sig)) {
    log.v(`Bad signature: uid=${uid} sig=${sig}`);
    return null;
  }

  log.v(`Signature for uid=${uid} is OK`, Date.now() - ts, 'ms');
  return uid;
}

async function verifySignature(req: IncomingMessage, pubkey: string, sig: string) {
  log.v('Downloading RPC body to verify signature.');
  let body = await downloadRequestBody(req);
  return ed25519.verify(
    Buffer.from(req.url + '\n' + body, 'utf8'),
    Buffer.from(sig, 'hex'),
    Buffer.from(pubkey, 'hex'));
}

function parseAuthToken(token: string): typeof tAuthToken.input {
  try {
    let json = JSON.parse(token);
    tAuthToken.verifyInput(json);
    return json;
  } catch (err) {
    throw new BadRequest('Bad Auth', err.message);
  }
}
