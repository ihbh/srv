import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import conf from './conf';
import { log } from './log';

export default class FSS {
  readonly basedir: string;

  constructor(dir: string) {
    this.basedir = path.join(conf.dirs.base, dir);
    log.i('FSS:', this.basedir);
  }

  exists(relpath: string) {
    let fpath = path.join(this.basedir, relpath);
    return fs.existsSync(fpath);
  }

  get(relpath: string): Buffer {
    let fpath = path.join(this.basedir, relpath);
    log.v('fss.get', fpath);
    if (!fs.existsSync(fpath))
      return null;
    return fs.readFileSync(fpath);
  }

  set(relpath: string, data: Buffer | string) {
    let fpath = path.join(this.basedir, relpath);
    log.v('fss.set', fpath);
    
    if (!fs.existsSync(fpath))
      mkdirp.sync(path.dirname(fpath));
    if (!Buffer.isBuffer(data))
      data = Buffer.from(data);
    fs.writeFileSync(fpath, data);
  }

  /** Same as set(get() + data), but faster. */
  append(relpath: string, data: Buffer | string) {
    let fpath = path.join(this.basedir, relpath);
    log.v('fss.append', fpath);

    if (!fs.existsSync(fpath)) {
      mkdirp.sync(path.dirname(fpath));
      fs.writeFileSync(fpath, '');
    }
    if (!Buffer.isBuffer(data))
      data = Buffer.from(data);
    fs.appendFileSync(fpath, data);
  }
};
