import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import conf from './conf';
import rlog from './log';

const log = rlog.fork('fss');

export default class FSS {
  readonly basedir: string;

  constructor(dir: string) {
    this.basedir = path.join(conf.dirs.base, dir);
    log.i('new FSS() basedir:', this.basedir);
  }

  exists(relpath: string) {
    let fpath = path.join(this.basedir, relpath);
    log.v('fss.exists', fpath);
    return fs.existsSync(fpath);
  }

  dir(relpath: string): string[] {
    let fpath = path.join(this.basedir, relpath);
    log.v('fss.dir', fpath);
    if (!fs.existsSync(fpath))
      return null;
    return fs.readdirSync(fpath);
  }

  get(relpath: string): Buffer {
    let fpath = path.join(this.basedir, relpath);
    log.v('fss.get', fpath);
    if (!fs.existsSync(fpath))
      return null;
    return fs.readFileSync(fpath);
  }

  set(relpath: string, data: Buffer | string | null) {
    let fpath = path.join(this.basedir, relpath);
    log.v('fss.set', fpath, data);

    if (data === null)
      return this.rm(relpath);

    if (!fs.existsSync(fpath))
      mkdirp.sync(path.dirname(fpath));
    if (!Buffer.isBuffer(data))
      data = Buffer.from(data);
    fs.writeFileSync(fpath, data);
  }

  rm(relpath: string) {
    let fpath = path.join(this.basedir, relpath);
    log.v('fss.rm', fpath);
    if (fs.existsSync(fpath)) {
      fs.unlinkSync(fpath);
      this.cleanup(relpath);
    }
  }

  rmdir(relpath: string) {
    let fpath = path.join(this.basedir, relpath);
    log.v('fss.rmdir', fpath);
    if (fs.existsSync(fpath)) {
      fs.rmdirSync(fpath);
      this.cleanup(relpath);
    }
  }

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

  private cleanup(relpath: string) {
    let i = relpath.lastIndexOf('/');
    if (i > 0) {
      let parent = relpath.slice(0, i);
      let empty = this.dir(parent).length < 1;
      if (empty) {
        log.v('Cleaning up empty dir:', parent);
        this.rmdir(parent);
      }
    }
  }
};
