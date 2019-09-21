import * as path from 'path';
import conf, { VFS_USERS_DIR } from './conf';
import { NotImplemeted } from './errors';
import FSS from './fss';
import * as rttv from './rttv';
import * as vfs from './vfs';

const fsdb = new FSS(conf.dirs.kvs.user);
const tVfsPath = rttv.RegEx(/^\/[\da-f]{16}\/.+$/);

const tUserName = rttv.RegEx(/^\w{3,20}$/);
const tUserPhoto = rttv.RegEx(/^data:image\/jpeg;base64,\S+$/);
const tUserInfo = rttv.AsciiText(1024);
const tPubKey = rttv.HexNum(64);
const tUserId = rttv.HexNum(16);

const tSchema = rttv.keyval(
  tUserId,
  rttv.subset({
    profile: rttv.subset({
      name: tUserName,
      info: tUserInfo,
      photo: tUserPhoto,
      pubkey: tPubKey,
    })
  })
);

@vfs.mount(VFS_USERS_DIR, {
  path: tVfsPath,
  data: rttv.json,
  schema: tSchema,
})
export class VfsUser {
  exists(vfspath: string): boolean {
    let { uid, key } = parsePath(vfspath);
    let fsspath = fssPath(uid, key);
    return fsdb.exists(fsspath);
  }

  get(vfspath: string) {
    let { uid, key } = parsePath(vfspath);
    let fsspath = fssPath(uid, key);
    let data = fsdb.get(fsspath);
    if (!data) return null;
    let json = data.toString('utf8');
    return JSON.parse(json);
  }

  set(vfspath: string, data) {
    let { uid, key } = parsePath(vfspath);
    let fsspath = fssPath(uid, key);
    let json = data === null ? null :
      JSON.stringify(data);
    fsdb.set(fsspath, json);
  }

  append(vfspath: string, data) {
    throw new NotImplemeted();
  }
}

function parsePath(vfspath: string) {
  let uid = Buffer.from(vfspath.slice(1, 17), 'hex');
  let key = vfspath.slice(18); // e.g. "profile/name"
  return { uid, key };
}

function fssPath(uid: Buffer, filepath: string) {
  let hexkey = uid.toString('hex');
  return path.join(
    hexkey.slice(0, 3),
    hexkey.slice(3, 6),
    hexkey.slice(6),
    filepath);
}
