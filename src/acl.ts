import { ANON_PATHS, VFS_USERS_DIR } from "./conf";
import { VfsAclError } from "./errors";
import { log } from './log';

export function check(op: 'get' | 'set', uid: string | null, path: string) {
  if (!test(op, uid, path))
    throw new VfsAclError(op, path);
}

export function test(op: 'get' | 'set', uid: string | null, path: string) {
  log.v('ACL check:', op, uid, path);
  let udir = VFS_USERS_DIR + '/' + uid + '/';
  switch (op) {
    case 'get':
      return ANON_PATHS.test(path) ||
        uid && path.startsWith(udir);
    case 'set':
      return uid && path.startsWith(udir);
    default:
      throw new Error('Bad vfs op: ' + op);
  }
}
