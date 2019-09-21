import { IncomingMessage } from 'http';
import { BadRequest, Unauthorized } from './errors';
import { downloadRequestBody } from './http-util';
import { log } from './log';
import * as rpc from './rpc';
import * as sc from './sc';
import * as val from './scheme';
import * as vfs from './vfs';
import { VFS_USERS_DIR, PUBKEY_PATH } from './conf';

const AUTHORIZATION = 'Authorization';

export const UserId = val.HexNum(16);
export const UserSig = val.HexNum(128);

const AuthToken = val.Dictionary({
  uid: UserId,
  sig: val.Optional(UserSig),
});

interface AuthToken {
  uid: string;
  sig: string;
}

export function RequiredUserId() {
  return rpc.ParamDep(async ctx => {
    let uid = await getUserId(ctx.req);
    if (!uid) throw new Unauthorized('Bad Sig');
    return uid;
  });
}

export function OptionalUserId() {
  return rpc.ParamDep(async ctx => {
    let uid = await getUserId(ctx.req);
    return uid || null;
  });
}

async function getUserId(req: IncomingMessage) {
  let token = req.headers[AUTHORIZATION.toLowerCase()] as string;
  if (!token) {
    log.v(`No ${AUTHORIZATION} header.`);
    return null;
  }

  let { uid, sig } = parseAuthToken(token);
  let pkpath = PUBKEY_PATH.replace('~', VFS_USERS_DIR + '/' + uid);
  let pubkey = vfs.root.get(pkpath);

  if (!pubkey) {
    log.v('No pubkey for', uid);
    // This means that until <uid> sets pubkey,
    // anyone can impersonate that <uid>.
    return uid;
  }

  if (!await verifySignature(req, pubkey, sig)) {
    log.v('Bad signature:', uid, sig);
    return null;
  }

  return uid;
}

async function verifySignature(req: IncomingMessage, pubkey: string, sig: string) {
  log.v('Downloading RPC body to verify signature.');
  let body = await downloadRequestBody(req);
  return sc.verify(
    Buffer.from(req.url + '\n' + body, 'utf8'),
    Buffer.from(sig, 'hex'),
    Buffer.from(pubkey, 'hex'));
}

function parseAuthToken(token: string) {
  try {
    let json: AuthToken = JSON.parse(token);
    AuthToken.verifyInput(json);
    return json;
  } catch (err) {
    throw new BadRequest('Bad Auth', err.message);
  }
}
