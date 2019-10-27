import rlog from './log';

const log = rlog.fork('sync');
const slocks = new Map<any, Promise<void>>();

export async function synchronized(target, fn: () => Promise<void>) {
  let slock = slocks.get(target);
  if (slock) {
    log.v('waiting:', target);
    await slock;
  }

  let tlock = null;
  slock = new Promise<void>(
    (resolve, reject) =>
      tlock = { resolve, reject });

  try {
    log.v('locking:', target);
    slocks.set(target, slock);
    await fn();
  } finally {
    log.v('unlocking:', target);
    slocks.delete(target);
    tlock.resolve();
  }
}
