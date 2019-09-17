import { IncomingMessage } from 'http';
import dbusers, { PUBKEY_PATH } from './db/users';
import { BadRequest, Unauthorized } from './errors';
import { downloadRequestBody } from './http-util';
import { log } from './log';
import * as rpc from './rpc';
import * as sc from './sc';
import * as val from './scheme';

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
  return rpc.ParamDep(async ({ req }) => {
    let token = req.headers[AUTHORIZATION.toLowerCase()] as string;
    if (!token) throw new BadRequest('Missing Auth');
    let { uid, sig } = parseAuthToken(token);
    let pubkey = dbusers.get(Buffer.from(uid, 'hex'), PUBKEY_PATH);
    if (pubkey)
      await verifySignature(req, pubkey, sig);
    else
      log.i('No pub key for', uid);
    return uid;
  });
}

async function verifySignature(req: IncomingMessage, pubkey: string, sig: string) {
  log.v('Downloading RPC body to verify signature.');
  let body = await downloadRequestBody(req);
  let valid = sc.verify(
    Buffer.from(req.url + '\n' + body, 'utf8'),
    Buffer.from(sig, 'hex'),
    Buffer.from(pubkey, 'hex'));
  if (!valid) {
    log.v('req.url:', req.url);
    throw new Unauthorized('Bad Sig');
  }
  log.v('Signature is OK.');
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
