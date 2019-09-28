import { VFS_PATH } from './conf';
import { BadRequest } from './errors';
import rlog, { logstr } from './log';
import * as rttv from './rttv';

const log = rlog.fork('vfs');

export declare interface VFS {
  exists?(path: string): boolean;
  get?(path: string): any;
  set?(path: string, data: any): void;
  add?(path: string, item: any): void;
  dir?(path: string): string[];
}

interface HandlerConfig {
  path: rttv.Validator<string>;
  data?: rttv.Validator<any>;
  schema?: rttv.Validator<any>;
}

interface Watcher {
  onchanged(wpid: string): void;
}

interface WatcherArgs {
  sync?: boolean;
  wpid?(path: string, ...args: string[]): string | null;
}

interface WatcherConfig {
  name: string;
  path: RegExp;
  sync: boolean;
  wpid(...args: string[]): string;
  handler: Watcher;
  pending: Set<string>;
}

const VFS_PATH_MASK = /^(\/([\w-]+|[*]))+$/;
const ROOT_PATH = /^\/\w+/;

let wtimer: NodeJS.Timeout = null;
const watchers: WatcherConfig[] = [];
const handlers = new Map<string, {
  handler: VFS;
  config: HandlerConfig;
}>();

export const root: VFS = new class {
  exists(path: string): boolean {
    log.v('vfs.exists', path);
    return invoke('exists', path);
  }

  dir(path: string): string[] {
    log.v('vfs.dir', path);
    return invoke('dir', path);
  }

  get(path: string): any {
    log.v('vfs.get', path);
    return invoke('get', path);
  }

  set(path: string, data: any) {
    log.v('vfs.set', path, data);
    if (data === undefined)
      throw new Error(`vfs.set cannot accept ${logstr(data)}`);
    return invoke('set', path, data);
  }

  add(path: string, entry: any) {
    log.v('vfs.add', path, entry);
    if (entry === undefined)
      throw new Error(`vfs.add cannot accept ${logstr(entry)}`);
    return invoke('add', path, entry);
  }
};

function invoke(method: keyof VFS, path: string, data?): any {
  if (!VFS_PATH.test(path))
    throw new SyntaxError('Invalid vfs path: ' + path);

  let [rootdir] = ROOT_PATH.exec(path);
  let relpath = path.slice(rootdir.length);
  let info = handlers.get(rootdir);

  if (!info)
    throw new Error('No vfs handler: ' + path);
  if (!info.handler[method])
    throw new Error(`vfs.${method} not supported on ${path}`);

  let { config } = info;

  if (!config.path.test(relpath)) {
    log.w('The vfs handler rejected the path.');
    throw new BadRequest('Bad Path');
  }

  if (data !== undefined && method == 'set') {
    if (config.data && !config.data.test(data)) {
      log.w('The vfs data rttv rejected the value.');
      throw new BadRequest(`Bad Data`);
    }
    if (config.schema && !isDataValid(config.schema, relpath, data)) {
      log.w('The vfs schema rttv rejected the value.');
      throw new BadRequest(`Bad Data`);
    }
  }

  try {
    let res = (info.handler[method] as any)(relpath, data);
    if (method == 'set' || method == 'add')
      initWatchers(path);
    return res;
  } catch (err) {
    log.w(`vfs.${method} ${path} failed: ${err}`);
    throw err;
  }
}

function initWatchers(path: string) {
  let time = Date.now();

  for (let w of watchers) {
    let match = w.path.exec(path);
    if (!match) continue;
    let wpid = w.wpid(...match);
    if (wpid) {
      w.pending.add(wpid);
      if (w.sync) {
        log.v(`Sync watcher: ${w.name}`);
        execWatcher(w);
      }
    }
  }

  let diff = Date.now() - time;
  if (diff > 0) log.v(`Watchers spent ${diff} ms on ${path}`);

  wtimer = wtimer || setTimeout(execWatchers, 0);
}

function execWatchers() {
  wtimer = null;
  let time = Date.now();

  for (let w of watchers)
    execWatcher(w);

  let diff = Date.now() - time;
  if (diff > 0) log.v(`Watchers spent ${diff} ms.`);
}

function execWatcher(w: WatcherConfig) {
  if (!w.pending.size) return;
  let wpids = [...w.pending];
  w.pending.clear();
  for (let wpid of wpids) {
    log.v(`Triggering ${w.name} on ${wpid}.`);
    try {
      w.handler.onchanged(wpid);
    } catch (err) {
      log.e(`Watcher ${w.name} failed on ${wpid}:`, err);
    }
  }
}

function isDataValid(schema: rttv.Validator<any>, path: string, data) {
  let keys = path.slice(1).split('/');
  let json = {}, p = json;

  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    if (i == keys.length - 1) {
      p[key] = data;
    } else {
      p = p[key] = {};
    }
  }

  try {
    schema.verifyInput(json);
    return true;
  } catch (err) {
    log.v('Error at vfs path:', path, data, err);
    return false;
  }
}

/** e.g. @vfs.mount("/user") */
export function mount(path: string, config: HandlerConfig) {
  if (!ROOT_PATH.test(path))
    throw new Error('Invalid vfs.mount() path: ' + path);
  if (handlers.has(path))
    throw new Error('vfs.mount() already exists: ' + path);

  return function decorate(ctor: new () => VFS) {
    log.i('vfs.mount', path, ctor.name);
    if (!ctor.name)
      throw new Error('vfs.mount() applied to an anon class.');

    handlers.set(path, {
      handler: new ctor,
      config: config,
    });
  };
}

/** e.g. @vfs.watch("/user/<uid>/places/<tskey>/**") */
export function watch(pathmask: string, args: WatcherArgs = {}) {
  if (!VFS_PATH_MASK.test(pathmask))
    throw new Error('Invalid vfs path mask: ' + pathmask);
  let regex = pathmask.replace(/\*/g, '([^/]+)');
  return function decorate(ctor: new () => Watcher) {
    if (!ctor.name)
      throw new Error('Unnamed vfs watcher.');
    log.i(`${ctor.name} is watching ${pathmask}`);
    watchers.push({
      name: ctor.name,
      path: new RegExp('^' + regex + '$'),
      wpid: args.wpid || (path => path),
      sync: !!args.sync,
      handler: new ctor,
      pending: new Set,
    });
  };
}
