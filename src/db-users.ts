import * as path from 'path';
import conf from './conf';
import FSS from './fss';
import * as val from './scheme';

const fsdb = new FSS(conf.dirs.kvs.user);
const ufpath = val.RegEx(/^profile\/(name|info|photo|pubkey)$/);

function relpath(uid: Buffer, filepath: string) {
  let hexkey = uid.toString('hex');
  return path.join(
    hexkey.slice(0, 3),
    hexkey.slice(3, 6),
    hexkey.slice(6),
    filepath);
}

export default new class UsersDB {
  exists(uid: Buffer) {
    let key = relpath(uid, '');
    return fsdb.exists(key);
  }

  get(uid: Buffer, path: string) {
    ufpath.validate(path);
    let key = relpath(uid, path);
    let data = fsdb.get(key);
    if (!data) return null;
    let json = data.toString('utf8');
    return JSON.parse(json);
  }

  set(uid: Buffer, path: string, data) {
    ufpath.validate(path);
    let key = relpath(uid, path);
    let json = data === null ? null :
      JSON.stringify(data);
    fsdb.set(key, json);
  }
};
