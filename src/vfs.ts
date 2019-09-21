import { BadRequest } from './errors';
import { log } from './log';
import * as rttv from './rttv';

export declare interface VFS {
  exists(path: string): boolean;
  get(path: string): any;
  set(path: string, data: any): void;
  /** Same as set(get() + data), but faster. */
  append(path: string, data: any): void;
}

interface HandlerConfig {
  path: rttv.Validator<string>;
  data?: rttv.Validator<any>;
  schema?: rttv.Validator<any>;
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
    if (data === undefined)
      throw new Error(`vfs.set cannot accept ${data}`);
    return invoke('set', path, data);
  }

  append(path: string, data: any) {
    if (data === undefined)
      throw new Error(`vfs.append cannot accept ${data}`);
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

  let { config } = info;

  if (!config.path.test(relpath))
    throw new BadRequest('Bad Path');

  if (data !== undefined) {
    if (config.data && !config.data.test(data))
      throw new BadRequest(`Bad Data`);
    if (config.schema && !isDataValid(config.schema, relpath, data))
      throw new BadRequest(`Bad Data`);
  }

  try {
    return (info.handler[method] as any)(relpath, data);
  } catch (err) {
    log.w(`vfs.${method} ${path} failed: ${err}`);
    throw err;
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
