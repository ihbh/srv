import { registerHandler } from './handlers/http-handler';
import { downloadRequestBody } from './http-util';
import { log } from './log';
import * as qps from './qps';
import { BadRequest } from './errors';
import * as http from 'http';

const RPC_HTTP_METHOD = 'POST'; // e.g. POST /rpc/Users.GetDetails

type ClassCtor = Function;
type ClassMethodName = string;

interface ParamDepResolver<T> {
  (req: http.IncomingMessage): Promise<T> | T;
}

class RpcMethodInfo {
  rpcMethodName: string = '';
  argDeps: ParamDepResolver<any>[] = [];
}

let rpcMethodTags = new Map<ClassCtor,
  Map<ClassMethodName, RpcMethodInfo>>();

function getMethodTags(proto, classMethodName: string) {
  let tags = rpcMethodTags.get(proto);
  if (!tags) rpcMethodTags.set(proto, tags = new Map);
  let info = tags.get(classMethodName);
  if (!info) tags.set(classMethodName, info = new RpcMethodInfo);
  return info;
}

/** e.g. @rpc.Service('FooBar') */
export function Service(rpcServiceName: string) {
  log.v('rpc.Service()', rpcServiceName);
  let instance = null;

  return function decorate(target) {
    log.v('rpc.Service:decorate()', target);
    if (!target.name)
      throw new Error('@rpc.Service cannot be used with anon classes');

    let tags = rpcMethodTags.get(target.prototype);
    if (!tags) throw new Error(
      '@rpc.Service cannot be used without @rpc.Method');

    for (let [classMethodName, methodInfo] of tags) {
      let { rpcMethodName } = methodInfo;
      let urlPattern = `/rpc/${rpcServiceName}.${rpcMethodName}`;
      log.i(target.name + '.' + classMethodName, ':',
        urlPattern);

      let qpsNamePrefix = 'rpc.' + rpcServiceName + '.' + rpcMethodName;
      let nRequests = qps.register(qpsNamePrefix + '.reqs', 'qps');
      let nReqErrors = qps.register(qpsNamePrefix + '.errs', 'qps');
      let nReqTime = qps.register(qpsNamePrefix + '.time', 'avg');

      registerHandler(RPC_HTTP_METHOD, urlPattern, async req => {
        let time = Date.now();
        if (!instance) instance = new target;

        try {
          nRequests.add();
          log.v(`Invoking ${rpcServiceName}.${rpcMethodName}`);
          let args = await resolveRpcArgs(req, methodInfo);
          let resp = await instance[classMethodName](...args);
          return { json: resp };
        } catch (err) {
          nReqErrors.add();
          throw err;
        } finally {
          nReqTime.add(Date.now() - time);
        }
      });
    }
  };
}

async function resolveRpcArgs(req: http.IncomingMessage, info: RpcMethodInfo) {
  let args = [];
  for (let i = 0; i < info.argDeps.length; i++) {
    let resolve = info.argDeps[i];
    log.v(`Resolving arg #${i}`);
    args[i] = resolve ? await resolve(req) : null;
  }
  return args;
}

/** e.g. @rpc.Method('GetData') */
export function Method(rpcMethodName: string) {
  log.v('rpc.Method()', rpcMethodName);
  return function decorate(proto, classMethodName: string) {
    log.v('rpc.Method:decorate()', proto, classMethodName);
    let info = getMethodTags(proto, classMethodName);
    info.rpcMethodName = rpcMethodName;
  };
}

/** e.g. @rpc.ParamDep(req => req.headers.foo) */
export function ParamDep<T>(resolve: ParamDepResolver<T>) {
  log.v('rpc.ParamDep()');
  return function decorate(proto, method: string, paramId: number) {
    log.v('rpc.ParamDep()', proto, method, paramId);
    let info = getMethodTags(proto, method);
    info.argDeps[paramId] = resolve;
  };
}

export function ReqBody<T>() {
  return ParamDep<T>(async req => {
    let json = await downloadRequestBody(req);
    log.v('RPC request body:', json);
    try {
      return JSON.parse(json);
    } catch (err) {
      throw new BadRequest('Bad JSON');
    }
  });
}
