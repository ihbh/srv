import { ANON_PATHS, VFS_USERS_DIR } from "./conf";
import { VfsAclError } from "./errors";

export function check(op: 'get' | 'set', uid: string | null, path: string) {
  if (!test(op, uid, path))
    throw new VfsAclError(op, path);
}

export function test(op: 'get' | 'set', uid: string | null, path: string) {
  switch (op) {
    case 'get':
      return ANON_PATHS.test(path);
    case 'set':
      if (!uid) return false;
      let udir = VFS_USERS_DIR + '/' + uid + '/';
      return path.startsWith(udir);
    default:
      throw new Error('Bad vfs op: ' + op);
  }
}
