import rlog from './log';
import LRUCache from 'lru-cache';

const log = rlog.fork('rpool');

export default class RPool<T> {
  private cache: LRUCache<string, T>;

  constructor(public name: string, size: number,
    private make: (key: string) => T) {
    this.cache = new LRUCache(size);
  }

  get(key: string) {
    let res = this.cache.get(key);
    if (res) return res;
    log.v('Create:', key);
    res = this.make(key);
    this.cache.set(key, res);
    return res;
  }
}
