import * as path from 'path';
import FSS from './fss';

function relpath(key: Buffer) {
  let hexkey = key.toString('hex');
  return path.join(
    hexkey.slice(0, 3) || '-',
    hexkey.slice(3, 6) || '-',
    hexkey.slice(6) || '-');
}

export default class KVS {
  readonly fss: FSS;

  constructor(dir: string) {
    this.fss = new FSS(dir);
  }

  get(key: Buffer): Buffer {
    let path = relpath(key);
    return this.fss.get(path);
  }

  set(key: Buffer, data: Buffer | string) {
    let path = relpath(key);
    this.fss.set(path, data);
  }

  /** Same as set(get() + data), but faster. */
  append(key: Buffer, data: Buffer | string) {
    let path = relpath(key);
    this.fss.append(path, data);
  }
};
