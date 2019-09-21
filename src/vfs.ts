import { log } from './log';
import * as rttv from './scheme';

export declare interface VFS {
  exists(path: string): boolean;
  get(path: string): any;
  set(path: string, data: any): void;
  /** Same as set(get() + data), but faster. */
  append(path: string, data: any): void;
}

interface HandlerConfig {
  path: rttv.Validator<string>;
  data: rttv.Validator<any>;
}

const VFS_PATH = /^(\/\w+)+$/;
const ROOT_PATH = /^\/\w+/;
const handlers = new Map<string, {
  handler: VFS;
  config: HandlerConfig;
}>();

export const root: VFS = new class {
  exists(path: string): boolean {
    return invoke('exists', path);
  }

  get(path: string): any {
    return invoke('get', path);
  }

  set(path: string, data: any) {
    return invoke('set', path, data);
  }

  append(path: string, data: any) {
    return invoke('append', path, data);
  }
};

function invoke(method: keyof VFS, path: string, data?): any {
  log.v(`vfs.${method} ${path}`, data);
  if (!VFS_PATH.test(path))
    throw new SyntaxError('Invalid vfs path: ' + path);

  let [rootdir] = ROOT_PATH.exec(path);
  let relpath = path.slice(rootdir.length);
  let info = handlers.get(rootdir);

  if (!info)
    throw new Error('No vfs handler: ' + path);
  if (!info.config.path.test(relpath))
    throw new Error('Invalid vfs path: ' + path);
  if (data !== undefined && !info.config.data.test(data))
    throw new Error(`Invalid vfs data ${path}: ${data}`);

  try {
    return (info.handler[method] as any)(relpath, data);
  } catch (err) {
    log.e(`vfs.${method} ${path} failed: ${err}`);
    throw err;
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
