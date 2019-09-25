import * as path from 'path';
import conf, { VFS_USERS_DIR } from './conf';
import { NotImplemeted } from './errors';
import FSS from './fss';
import * as rttv from './rttv';
import * as vfs from './vfs';

const fsdb = new FSS(conf.dirs.kvs.user);

const tSchema = rttv.keyval({
  key: rttv.uid,
  val: rttv.subset({
    profile: rttv.subset({
      id: rttv.uid,
      name: rttv.RegEx(/^\w{3,20}$/),
      info: rttv.AsciiText(1024),
      img: rttv.dataurl('image/jpeg'),
      pubkey: rttv.pubkey,
    }),
    places: rttv.keyval({
      key: rttv.tskey,
      val: rttv.subset({
        time: rttv.MinMax(
          Math.round(new Date('2000-1-1').getTime() / 1000),
          Math.round(new Date('2100-1-1').getTime() / 1000)),
        lat: rttv.lat,
        lon: rttv.lon,
      }),
    }),
  }),
});

@vfs.mount(VFS_USERS_DIR, {
  path: rttv.RegEx(/^\/[\da-f]{16}\/.+$/),
  data: rttv.json,
  schema: tSchema,
})
class VfsUser {
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
