import { VFS_USERS_DIR } from './conf';
import dbusers from './db-users';
import { NotImplemeted } from './errors';
import * as rttv from './scheme';
import * as vfs from './vfs';

const tPath = rttv.RegEx(/^\/([\da-f]{16})(\/.+)?$/);

@vfs.mount(VFS_USERS_DIR, {
  path: tPath,
  data: rttv.json,
})
export class UserFS {
  exists(path: string): boolean {
    let { uid, relpath } = parsePath(path);
    if (relpath) throw new NotImplemeted();
    return dbusers.exists(uid);
  }

  get(path: string) {
    let { uid, relpath } = parsePath(path);
    return dbusers.get(uid, relpath);
  }

  set(path: string, json) {
    let { uid, relpath } = parsePath(path);
    return dbusers.set(uid, relpath, json);
  }

  append(path: string, json) {
    throw new NotImplemeted();
  }
}

function parsePath(path: string) {
  let uid = Buffer.from(path.slice(1, 17), 'hex');
  let relpath = path.slice(18); // e.g. "profile/name"
  return { uid, relpath };
}

