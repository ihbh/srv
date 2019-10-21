import * as fs from 'fs';
import log from './log';

export const CONF_JSON = './conf.json';

export const VFS_PATH = /^(\/[\w-]+)+$/;
// Here ~ refers to /users/<uid> in vfs.
export const VFS_USERS_DIR = '/users';
export const VFS_VMAP_DIR = '/vmap';
export const VFS_REPORTS_DIR = '/reports';
export const VFS_FEEDBACKS_DIR = '/feedbacks';
export const PROFILE_DIR = '~/profile';
export const PUBKEY_PATH = PROFILE_DIR + '/pubkey';
export const ANON_PATHS = /^\/users\/\w+\/profile\/\w+$/;
export const P2P_CHAT_PATH = /^\/users\/(\w+)\/chats\/(\w+)/;

interface GConfig {
  port: number;
  reqbody: {
    maxlen: number;
  }
  gzip: {
    size: number;
  }
  dirs: {
    base: string;
    kvs: {
      feedbacks: string;
      reports: string;
      places: string;
      map: string;
      user: string;
    }
  }
  rsync: {
    maxFilePathLen: number;
    maxFileSizeLen: number;
  }
  cert: {
    dir: string;
    keyfile: string;
    certfile: string;
  }
  map: {
    cell: number;
  }
}

let config = {} as GConfig;

export function initConfig(path: string) {
  log.i('Config:', path);
  let json = JSON.parse(fs.readFileSync(path, 'utf8'));
  Object.assign(config, json);
}

export default config;
