import { ANON_PATHS, VFS_USERS_DIR, P2P_CHAT_PATH } from "./conf";
import { VfsAclError } from "./errors";
import rlog from './log';

const log = rlog.fork('acl');

export function check(op: 'get' | 'set', uid: string | null, path: string) {
  if (!test(op, uid, path))
    throw new VfsAclError(op, path);
}

export function test(op: 'get' | 'set', uid: string | null, path: string) {
  log.v('ACL check:', op, uid, path);
  let udir = VFS_USERS_DIR + '/' + uid + '/';
  switch (op) {
    case 'get':
      if (ANON_PATHS.test(path))
        return true;
      if (uid && path.startsWith(udir))
        return true;
      if (P2P_CHAT_PATH.test(path)) {
        let [, u1, u2] = P2P_CHAT_PATH.exec(path);
        return u1 == uid || u2 == uid;
      }
      return false;
    case 'set':
      return uid && path.startsWith(udir);
    default:
      throw new Error('Bad vfs op: ' + op);
  }
}
