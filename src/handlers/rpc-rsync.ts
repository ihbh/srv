import * as auth from '../auth';
import conf, { VFS_USERS_DIR } from '../conf';
import rlog from '../log';
import * as rpc from '../rpc';
import * as rttv from '../rttv';
import * as vfs from '../vfs';
import * as acl from '../acl';

const log = rlog.fork('rsync');

const FilePath = rttv.str(
  /^[~]?(\/[\w-_]+)+$/,
  0, conf.rsync.maxFilePathLen);

const AddFileReq = rttv.dict({
  path: FilePath,
  data: rttv.json,
});

const abspath = (uid: string, path: string) =>
  path.replace('~', VFS_USERS_DIR + '/' + uid);

@rpc.Service('RSync')
class RpcRSync {
  @rpc.Method('AddFile', rttv.nothing)
  async add(
    @auth.RequiredUserId() uid: string,
    @rpc.ReqBody(AddFileReq) { path, data }:
      typeof AddFileReq.input) {

    log.v(`Adding file for uid=${uid}:`, path);
    let vpath = abspath(uid, path);
    acl.check('set', uid, vpath);
    vfs.root.set(vpath, data);
  }

  @rpc.Method('GetFile', rttv.anything)
  async get(
    @auth.OptionalUserId() uid: string,
    @rpc.ReqBody(FilePath) path: string) {

    log.v(`Getting file for uid=${uid}:`, path);
    let vpath = abspath(uid, path);
    acl.check('get', uid, vpath);
    return vfs.root.get(vpath);
  }

  @rpc.Method('Dir', rttv.nullor(rttv.list(rttv.ascii())))
  async dir(
    @auth.OptionalUserId() uid: string,
    @rpc.ReqBody(FilePath) path: string) {

    log.v(`Getting subdirs for uid=${uid}:`, path);
    let vpath = abspath(uid, path);
    acl.check('dir', uid, vpath);
    return vfs.root.dir(vpath);
  }
}
