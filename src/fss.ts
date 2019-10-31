import * as fs from 'fs';
import mkdirp from 'mkdirp';
import * as path from 'path';
import conf from './conf';
import rlog from './log';

const log = rlog.fork('fss');

const pfn = <T>(fn: (cb: (err, res?: T) => void) => void) =>
  new Promise<T>(
    (resolve, reject) => fn(
      (err, res) => err ?
        reject(err) :
        resolve(res)));

export default class FSS {
  readonly basedir: string;

  constructor(dir: string) {
    this.basedir = path.join(conf.dirs.base, dir);
    log.i('new FSS() basedir:', this.basedir);
  }

  exists(relpath: string): Promise<boolean> {
    let fpath = path.join(this.basedir, relpath);
    log.v('exists', fpath);
    return new Promise(
      resolve => fs.exists(fpath, resolve));
  }

  dir(relpath: string): Promise<null | string[]> {
    let fpath = path.join(this.basedir, relpath);
    log.v('dir', fpath);
    if (!fs.existsSync(fpath))
      return null;
    return pfn(cb => fs.readdir(fpath, cb));
  }

  get(relpath: string): Promise<null | Buffer> {
    let fpath = path.join(this.basedir, relpath);
    log.v('get', fpath);
    if (!fs.existsSync(fpath))
      return null;
    return pfn(cb => fs.readFile(fpath, cb));
  }

  set(relpath: string, data: Buffer | string | null): Promise<void> {
    let fpath = path.join(this.basedir, relpath);
    log.v('set', fpath, data);

    if (data === null)
      return this.rm(relpath);

    if (!fs.existsSync(fpath))
      mkdirp.sync(path.dirname(fpath));
    if (!Buffer.isBuffer(data))
      data = Buffer.from(data);
    return pfn(cb => fs.writeFile(fpath, data, cb));
  }

  async rm(relpath: string): Promise<void> {
    let fpath = path.join(this.basedir, relpath);
    log.v('rm', fpath);
    if (await this.exists(relpath)) {
      await pfn(cb => fs.unlink(fpath, cb));
      await this.cleanup(relpath);
    }
  }

  async rmdir(relpath: string): Promise<void> {
    let fpath = path.join(this.basedir, relpath);
    log.v('rmdir', fpath);
    if (await this.exists(relpath)) {
      await pfn(cb => fs.rmdir(fpath, cb));
      await this.cleanup(relpath);
    }
  }

  async append(relpath: string, data: Buffer | string): Promise<void> {
    let fpath = path.join(this.basedir, relpath);
    log.v('append', fpath);

    if (!await this.exists(relpath)) {
      await pfn(cb => mkdirp(path.dirname(fpath), cb));
      await pfn(cb => fs.writeFile(fpath, '', cb));
    }

    if (!Buffer.isBuffer(data))
      data = Buffer.from(data);
    await pfn(cb => fs.appendFile(fpath, data, cb));
  }

  private async cleanup(relpath: string) {
    log.v('cleanup', relpath);
    let i = relpath.lastIndexOf('/');
    if (i > 0) {
      let parent = relpath.slice(0, i);
      let names = await this.dir(parent);
      let empty = names.length < 1;
      if (empty) {
        log.v('Cleaning up empty dir:', parent);
        await this.rmdir(parent);
      }
    }
  }
};
