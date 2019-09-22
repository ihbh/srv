import { BadRequest } from './errors';
import { log } from './log';
import * as rttv from './rttv';

export declare interface VFS {
  exists?(path: string): boolean;
  get?(path: string): any;
  set?(path: string, data: any): void;
  add?(path: string, entry: any): void;
}

interface HandlerConfig {
  path: rttv.Validator<string>;
  data?: rttv.Validator<any>;
  schema?: rttv.Validator<any>;
}

interface Watcher {
  onchanged(path: string, args?: string[]): void;
}

interface WatcherConfig {
  name: string;
  path: RegExp;
  handler: Watcher;
}

const VFS_PATH = /^(\/\w+)+$/;
const VFS_PATH_MASK = /^(\/(\w+|[*]))+$/;
const ROOT_PATH = /^\/\w+/;

let wtimer: NodeJS.Timeout = null;
const wpaths: string[] = [];
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

  get(path: string): any {
    log.v('vfs.get', path);
    return invoke('get', path);
  }

  set(path: string, data: any) {
    log.v('vfs.set', path, data);
    if (data === undefined)
      throw new Error(`vfs.set cannot accept ${data}`);
    return invoke('set', path, data);
  }

  add(path: string, entry: any) {
    log.v('vfs.add', path, entry);
    if (entry === undefined)
      throw new Error(`vfs.add cannot accept ${entry}`);
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
  wpaths.push(path);
  wtimer = wtimer || setTimeout(execWatchers, 0);
}

function execWatchers() {
  wtimer = null;
  for (let path of wpaths.splice(0)) {
    let time = Date.now();

    for (let w of watchers) {
      let match = w.path.exec(path);
      if (!match) continue;
      let args = match.slice(1);
      log.v(`Triggering ${w.name} on ${path}:`, args);
      try {
        w.handler.onchanged(path, args);
      } catch (err) {
        log.e(`Watcher ${w.name} failed on ${path}:`, err);
      }
    }

    let diff = Date.now() - time;
    if (diff > 0) log.v(`Watchers on ${path} spent ${diff} ms.`);
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
    log.v('vfs', path, data, err);
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
export function watch(pathmask: string) {
  if (!VFS_PATH_MASK.test(pathmask))
    throw new Error('Invalid vfs path mask: ' + pathmask);
  let regex = pathmask.replace(/\*/g, '([^/]+)');
  return function decorate(ctor: new () => Watcher) {
    if (!ctor.name)
      throw new Error('Unnamed vfs watcher.');
    watchers.push({
      name: ctor.name,
      path: new RegExp('^' + regex + '$'),
      handler: new ctor,
    });
  };
}
