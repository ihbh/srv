import rlog from './log';

const log = rlog.fork('rpool');

export default class RPool<T> {
  private cache = new Map<string, T>();

  constructor(public name: string,
    private make: (key: string) => T) {

  }

  get(key: string) {
    let res = this.cache.get(key);
    if (res) return res;
    log.v('Create:', key);
    res = res = this.make(key);
    this.cache.set(key, res);
    return res;
  }
}
