import * as acl from '../acl';
import * as auth from '../auth';
import conf, { VFS_USERS_DIR } from '../conf';
import rlog from '../log';
import * as rpc from '../rpc';
import * as rttv from '../rttv';
import * as vfs from '../vfs';

const log = rlog.fork('rsync');

const tFilePath = rttv.str(
  /^(\/|[~]?(\/[\w-_]+)+)$/,
  0, conf.rsync.maxFilePathLen);

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
    vfs.root.rm(vpath);
  }

  @rpc.Method('AddFile', rttv.nothing)
  async set(
    @auth.RequiredUserId() uid: string,
    @rpc.ReqBody(tAddFileReq) { path, data }:
      typeof tAddFileReq.input) {

    log.v(`uid=${uid} adds a file:`, path);
    let vpath = abspath(uid, path);
    acl.check('set', uid, vpath);
    vfs.root.set(vpath, data);
  }

  @rpc.Method('GetFile', rttv.anything)
  async get(
    @auth.OptionalUserId() uid: string,
    @rpc.ReqBody(tFilePath) path: string) {

    log.v(`uid=${uid} reads a file:`, path);
    let vpath = abspath(uid, path);
    acl.check('get', uid, vpath);
    return vfs.root.get(vpath);
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
