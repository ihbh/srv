import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import conf from './conf';
import { log } from './log';

export default class KVS {
  readonly basedir: string;

  constructor(dir: string) {
    this.basedir = path.join(conf.dirs.base, dir);
    log.i('KVS:', this.basedir);
  }

  get(key: Buffer): Buffer {
    let fpath = this.getFilePath(key);
    if (!fs.existsSync(fpath))
      return null;
    return fs.readFileSync(fpath);
  }

  set(key: Buffer, data: Buffer | string) {
    let fpath = this.getFilePath(key);
    if (!fs.existsSync(fpath))
      mkdirp.sync(path.dirname(fpath));
    log.v('kvs.set', fpath, data);
    if (!Buffer.isBuffer(data))
      data = Buffer.from(data);
    fs.writeFileSync(fpath, data);
  }

  /** Same as set(get() + data), but faster. */
  append(key: Buffer, data: Buffer | string) {
    let fpath = this.getFilePath(key);
    if (!fs.existsSync(fpath)) {
      mkdirp.sync(path.dirname(fpath));
      fs.writeFileSync(fpath, '');
    }
    if (!Buffer.isBuffer(data))
      data = Buffer.from(data);
    fs.appendFileSync(fpath, data);
  }

  private getFilePath(key: Buffer) {
    let hexkey = key.toString('hex');
    return path.join(this.basedir,
      hexkey.slice(0, 3) || '-',
      hexkey.slice(3, 6) || '-',
      hexkey.slice(6) || '-');
  }
};
