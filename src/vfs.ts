import { VFS_PATH } from './conf';
import { BadRequest } from './errors';
import rlog, { logstr } from './log';
import * as rttv from './rttv';

const log = rlog.fork('vfs');

export declare interface VFS {
  invoke?(fsop: keyof VFS, path: string, ...args): any;
  exists?(path: string): boolean;
  get?(path: string): any;
  set?(path: string, data: any): void;
  add?(path: string, item: any): void;
  dir?(path: string): string[];
  rm?(path: string): void;
}

interface HandlerConfig {
  path: rttv.Validator<string>;
  data?: rttv.Validator<any>;
  schema?: rttv.Validator<any>;
}

interface Watcher<T> {
  onchanged(changes: T): void;
}

interface WatcherConf<T> {
  sync?: boolean;
  process(changes: T, match: any[]): T;
}

interface WatcherState<T> {
  name: string;
  path: RegExp;
  sync: boolean;
  handler: Watcher<T>;
  changes: T;
  process: WatcherConf<T>['process'];
}

const VFS_PATH_MASK = /^(\/([\w-]+|[*]))+$/;
const ROOT_PATH = /^\/\w+/;

let wtimer: NodeJS.Timeout = null;
const watchers: WatcherState<any>[] = [];
const handlers = new Map<string, {
  handler: VFS;
  config: HandlerConfig;
}>();

export const root: VFS = new class {
  exists(path: string): boolean {
    log.v('vfs.exists', path);
    return this.invoke('exists', path);
  }

  dir(path: string): string[] {
    log.v('vfs.dir', path);
    if (path == '/')
      return [...handlers.keys()]
        .map(p => p.slice(1));
    return this.invoke('dir', path);
  }

  get(path: string): any {
    log.v('vfs.get', path);
    return this.invoke('get', path);
  }

  set(path: string, data: any) {
    log.v('vfs.set', path, data);
    if (data === undefined)
      throw new Error(`vfs.set cannot accept ${logstr(data)}`);
    return this.invoke('set', path, data);
  }

  add(path: string, entry: any) {
    log.v('vfs.add', path, entry);
    if (entry === undefined)
      throw new Error(`vfs.add cannot accept ${logstr(entry)}`);
    return this.invoke('add', path, entry);
  }

  rm(path: string) {
    log.v('vfs.rm', path);
    return this.invoke('rm', path);
  }

  invoke(method: keyof VFS, path: string, data?) {
    if (!VFS_PATH.test(path))
      throw new SyntaxError('Invalid vfs path: ' + path);

    let [rootdir] = ROOT_PATH.exec(path);
    let relpath = path.slice(rootdir.length);
    let info = handlers.get(rootdir);

    if (!info)
      throw new Error('No vfs handler: ' + path);
    if (!info.handler[method] && !info.handler.invoke)
      throw new Error(`vfs.${method} not supported on ${path}`);

    let { config } = info;

    if (!config.path.test(relpath)) {
      log.w('The vfs handler rejected the path: ' + relpath);
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
      let res = info.handler[method] ?
        (info.handler[method] as any)(relpath, data) :
        info.handler.invoke(method, relpath, data);
      triggerWatchers(method, path);
      return res;
    } catch (err) {
      log.w(`vfs.${method} on ${path} failed: ${err}`);
      throw err;
    }
  }
};

function triggerWatchers(fsop: string, path: string) {
  if (fsop != 'set') return;
  let time = Date.now();

  for (let w of watchers) {
    let match = w.path.exec(path);
    if (!match) continue;
    w.changes = w.process(w.changes, match);
    if (w.changes && w.sync) {
      log.v(`Triggering sync watcher: ${w.name}`);
      execWatcher(w);
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
  if (diff > 0)
    log.v(`Watchers spent ${diff} ms.`);
}

function execWatcher(w: WatcherState<any>) {
  if (!w.changes) return;
  let changes = w.changes;
  w.changes = null;
  log.v(`Triggering watcher ${w.name}`);
  try {
    w.handler.onchanged(changes);
  } catch (err) {
    log.e(`Watcher ${w.name} failed:`, err);
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
export function watch<T>(pathmask: string, args: WatcherConf<T>) {
  if (!VFS_PATH_MASK.test(pathmask))
    throw new Error('Invalid vfs path mask: ' + pathmask);
  let regex = pathmask.replace(/\*/g, '([^/]+)');
  return function decorate(ctor: new () => Watcher<T>) {
    if (!ctor.name)
      throw new Error('Unnamed vfs watcher.');
    let handler = new ctor;
    if (!handler.onchanged)
      throw new Error(ctor.name + '.onchanged=null');
    watchers.push({
      name: ctor.name,
      path: new RegExp('^' + regex + '$'),
      sync: !!args.sync,
      process: args.process,
      changes: null,
      handler,
    });
    log.i(`Watcher: ${ctor.name} on ${pathmask}`);
  };
}
