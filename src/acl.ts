import { ANON_PATHS, VFS_USERS_DIR, P2P_CHAT_PATH } from "./conf";
import { VfsAclError } from "./errors";
import rlog from './log';

const log = rlog.fork('acl');

type vfsop = 'get' | 'set' | 'dir' | 'rm';

export function check(op: vfsop, uid: string | null, path: string) {
  if (!test(op, uid, path))
    throw new VfsAclError(op, path);
}

export function test(op: vfsop, uid: string | null, path: string) {
  log.v('ACL check:', op, uid, path);
  let udir = VFS_USERS_DIR + '/' + uid;
  switch (op) {
    case 'dir':
      if (path == '/')
        return true;
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
    case 'rm':
    case 'set':
      return uid && path.startsWith(udir);
    default:
      throw new Error('Bad vfs op: ' + op);
  }
}
