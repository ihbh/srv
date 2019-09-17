import * as fs from 'fs';
import { log } from './log';

export const CONF_JSON = './conf.json';

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
      places: string;
      map: string;
      user: string;
    }
  }
  rsync: {
    maxFilePathLen: number;
    maxFileSizeLen: number;
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
