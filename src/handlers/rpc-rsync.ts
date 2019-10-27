import * as crypto from 'crypto';
import * as acl from '../acl';
import * as auth from '../auth';
import conf, { VFS_USERS_DIR } from '../conf';
import rlog from '../log';
import * as rpc from '../rpc';
import * as rttv from '../rttv';
import * as vfs from '../vfs';

const log = rlog.fork('rsync');

const sha256 = (input: string) =>
  crypto.createHash('sha256')
    .update(input)
    .digest('hex');

const tFilePath = rttv.str(
  /^(\/|[~]?(\/[\w-_]+)+)$/,
  0, conf.rsync.maxFilePathLen);

const tGetFileReq = rttv.dict({
  path: tFilePath,
  hash: rttv.opt(rttv.hexnum(6, 64)), // sha256 prefix
});

const tAddFileReq = rttv.dict({
  path: tFilePath,
  data: rttv.json,
});

const tDelFileReq = rttv.dict({
  path: tFilePath,
});

const abspath = (uid: string, path: string) =>
  path.replace('~', VFS_USERS_DIR + '/' + uid);

@rpc.Service('RSync')
class RpcRSync {
  @rpc.Method('DeleteFile', rttv.nothing)
  async rm(
    @auth.RequiredUserId() uid: string,
    @rpc.ReqBody(tDelFileReq) { path }:
      typeof tDelFileReq.input) {

    log.v(`uid=${uid} deletes a file:`, path);
    let vpath = abspath(uid, path);
    acl.check('rm', uid, vpath);
    await vfs.root.rm(vpath);
  }

  @rpc.Method('AddFile', rttv.nothing)
  async set(
    @auth.RequiredUserId() uid: string,
    @rpc.ReqBody(tAddFileReq) { path, data }:
      typeof tAddFileReq.input) {

    log.v(`uid=${uid} adds a file:`, path, data);
    let vpath = abspath(uid, path);
    acl.check('set', uid, vpath);
    await vfs.root.set(vpath, data);
  }

  @rpc.Method('GetFile', rttv.anything)
  async get(
    @auth.OptionalUserId() uid: string,
    @rpc.ReqBody(tGetFileReq) { path, hash: chash }:
      typeof tGetFileReq.input) {

    log.v(`uid=${uid} reads a file:`, path);
    let vpath = abspath(uid, path);
    acl.check('get', uid, vpath);
    let data = await vfs.root.get(vpath);
    if (!chash) return data;

    let json = JSON.stringify(data);
    let shash = sha256(json);
    let matches = shash.startsWith(chash);
    log.v('client hash:', chash, matches ? '==' : '!=', shash);
    return matches ? null : data;
  }

  @rpc.Method('Dir', rttv.nullor(rttv.list(rttv.ascii())))
  async dir(
    @auth.OptionalUserId() uid: string,
    @rpc.ReqBody(tFilePath) path: string) {

    log.v(`uid=${uid} gets subdirs:`, path);
    let vpath = abspath(uid, path);
    if (vpath == '/users')
      return uid ? [uid] : [];
    acl.check('dir', uid, vpath);
    return vfs.root.dir(vpath);
  }
}
