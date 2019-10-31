import * as fs from 'fs';
import mkdirp from 'mkdirp';
import * as path from 'path';
import conf from './conf';
import rlog from './log';
import { VFS } from './vfs';

const log = rlog.fork('fss');

const pfn = <T>(fn: (cb: (err, res?: T) => void) => void) =>
  new Promise<T>(
    (resolve, reject) => fn(
      (err, res) => err ?
        reject(err) :
        resolve(res)));

const sp = (fpath: string) =>
  fpath.replace(conf.dirs.base, '~');

const ds = (data: Buffer | string | null) =>
  data ? data.length : 0;

const isENotEnt = err => err.code == 'ENOENT';

export default class FSS implements VFS {
  readonly basedir: string;

  constructor(dir: string) {
    this.basedir = path.join(conf.dirs.base, dir);
    log.i('new FSS()', sp(this.basedir));
  }

  exists(relpath: string): Promise<boolean> {
    let fpath = path.join(this.basedir, relpath);
    log.v('exists', sp(fpath));
    return new Promise(
      resolve => fs.exists(fpath, resolve));
  }

  dir(relpath: string): Promise<null | string[]> {
    let fpath = path.join(this.basedir, relpath);
    log.v('dir', sp(fpath));
    return pfn<string[]>(cb => fs.readdir(fpath, cb)).catch((err) => {
      if (!isENotEnt(err))
        throw err;
      return null;
    });
  }

  get(relpath: string): Promise<null | Buffer> {
    let fpath = path.join(this.basedir, relpath);
    log.v('get', sp(fpath));
    return pfn<Buffer>(cb => fs.readFile(fpath, cb)).catch((err) => {
      if (!isENotEnt(err))
        throw err;
      return null;
    });
  }

  async set(relpath: string, data: Buffer | string | null): Promise<void> {
    let fpath = path.join(this.basedir, relpath);
    log.v('set', fpath, ds(data));

    if (data === null)
      return this.rm(relpath);

    if (!Buffer.isBuffer(data))
      data = Buffer.from(data);

    try {
      await pfn(cb => fs.writeFile(fpath, data, cb));
    } catch (err) {
      if (!isENotEnt(err))
        throw err;

      log.v('set:mkdirp', sp(fpath));
      await pfn(cb => mkdirp(path.dirname(fpath), cb));
      await pfn(cb => fs.writeFile(fpath, data, cb));
    }
  }

  async rm(relpath: string): Promise<void> {
    let fpath = path.join(this.basedir, relpath);
    log.v('rm', sp(fpath));

    try {
      await pfn(cb => fs.unlink(fpath, cb));
    } catch (err) {
      if (!isENotEnt(err))
        throw err;
      return;
    }

    await this.cleanup(relpath);
  }

  async rmdir(relpath: string): Promise<void> {
    let fpath = path.join(this.basedir, relpath);
    log.v('rmdir', sp(fpath));

    try {
      await pfn(cb => fs.rmdir(fpath, cb));
    } catch (err) {
      if (!isENotEnt(err))
        throw err;
      return;
    }

    await this.cleanup(relpath);
  }

  async add(relpath: string, data: Buffer | string): Promise<void> {
    let fpath = path.join(this.basedir, relpath);
    log.v('append', sp(fpath), ds(data));

    if (!Buffer.isBuffer(data))
      data = Buffer.from(data);

    try {
      await pfn(cb => fs.appendFile(fpath, data, cb));
    } catch (err) {
      if (!isENotEnt(err))
        throw err;

      log.v('append:mkdirp', sp(fpath));
      await pfn(cb => mkdirp(path.dirname(fpath), cb));
      await pfn(cb => fs.appendFile(fpath, data, cb));
    }
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
