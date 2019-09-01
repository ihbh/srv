import { registerHandler } from './handlers/http-handler';
import { downloadRequestBody } from './http-util';
import { log } from './log';
import * as qps from './qps';
import { BadRequest } from './errors';

const RPC_HTTP_METHOD = 'POST'; // e.g. POST /rpc/Users.GetDetails

type ClassCtor = Function;
type ClassMethodName = string;
type RpcMethodName = string;
let rpcMethodTags = new Map<ClassCtor,
  Map<ClassMethodName, RpcMethodName>>();

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

    for (let [classMethodName, rpcMethodName] of tags) {
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
          let json = await downloadRequestBody(req);
          log.v('Invoking', urlPattern, json);
          let args = null;
          
          try {
            args = JSON.parse(json);
          } catch (err) {
            throw new BadRequest('Bad JSON');
          }

          let resp = await instance[classMethodName](args);
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

/** e.g. @rpc.Method('GetData') */
export function Method(rpcMethodName: string) {
  log.v('rpc.Method()', rpcMethodName);
  return function decorate(prototype, classMethodName: string) {
    log.v('rpc.Method:decorate()', prototype, classMethodName);
    let tags = rpcMethodTags.get(prototype);
    if (!tags) rpcMethodTags.set(prototype, tags = new Map);
    tags.set(classMethodName, rpcMethodName);
  };
}

export function Request() {
  return function decorate(proto, method: string, param: number) {

  };
}
