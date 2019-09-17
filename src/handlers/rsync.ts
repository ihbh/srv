import * as auth from '../auth';
import dbusers from '../db/users';
import { log } from '../log';
import * as rpc from '../rpc';
import * as val from '../scheme';
import conf from '../conf';

const FilePath = val.RegEx(
  /^\~(\/[\w-_]+)+$/,
  0, conf.rsync.maxFilePathLen);

const FileData = val.RegEx(
  /^[\x00-\xFF]*$/,
  0, conf.rsync.maxFileSizeLen);

const AddFileReq = val.Dictionary({
  path: FilePath,
  data: FileData,
});

@rpc.Service('RSync')
class RpcUsers {
  @rpc.Method('AddFile')
  async add(
    @auth.RequiredUserId() uidstr: string,
    @rpc.ReqBody(AddFileReq) { path, data }: typeof AddFileReq.input) {

    log.v(`Adding file for ${uidstr}:`, path);
    let uid = Buffer.from(uidstr, 'hex');
    dbusers.set(uid, path.slice(2), data);
  }

  @rpc.Method('GetFile')
  async get(
    @auth.RequiredUserId() uidstr: string,
    @rpc.ReqBody(FilePath) path: string) {

    log.v(`Getting file for ${uidstr}:`, path);
    let uid = Buffer.from(uidstr, 'hex');
    return dbusers.get(uid, path.slice(2));
  }
}
