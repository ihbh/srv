import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as sha1 from 'sha1';
import conf from './conf';
import { log } from './log';

export default class KVS {
  readonly basedir: string;

  constructor(dir: string) {
    this.basedir = path.join(conf.dirs.base, dir);
    log.i('kvs.init', this.basedir);
  }

  get(key: string): string {
    let fpath = this.getFilePath(key);
    if (!fs.existsSync(fpath))
      return null;
    return fs.readFileSync(fpath, 'utf8');
  }

  set(key: string, data: string) {
    let fpath = this.getFilePath(key);
    if (!fs.existsSync(fpath))
      mkdirp.sync(path.dirname(fpath));
    log.v('kvs.set', fpath, data);
    fs.writeFileSync(fpath, data, 'utf8');
  }

  /** Same as set(get() + data), but faster. */
  append(key: string, data: string) {
    let fpath = this.getFilePath(key);
    if (!fs.existsSync(fpath))
      mkdirp.sync(path.basename(fpath));
    fs.appendFileSync(fpath, data, 'utf8');
  }

  private getFilePath(key: string) {
    let hash: string = sha1(key);
    return path.join(this.basedir,
      hash.slice(0, 3),
      hash.slice(3, 6),
      hash.slice(6));
  }
};
