import rlog from './log';

const log = rlog.fork('sync');

export default class Sync {
  private slocks = new Map<any, Promise<void>>();

  constructor(public scope: string) { }

  async synchronized(target, fn: () => Promise<void>) {
    let slock = this.slocks.get(target);
    if (slock) {
      log.v('waiting', this.scope, target);
      await slock;
    }

    let tlock: any = null;
    slock = new Promise<void>(
      (resolve, reject) =>
        tlock = { resolve, reject });

    try {
      log.v('locking:', this.scope, target);
      this.slocks.set(target, slock);
      await fn();
    } finally {
      log.v('unlocking:', this.scope, target);
      this.slocks.delete(target);
      tlock.resolve();
    }
  }
}
