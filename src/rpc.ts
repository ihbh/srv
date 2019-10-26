import * as http from 'http';
import { BadRequest, NotFound } from './errors';
import { registerHandler } from './http-handler';
import { downloadRequestBody, getRequestId } from './http-util';
import rlog from './log';
import * as qps from './qps';
import * as rttv from './rttv';

const log = rlog.fork('rpc');

const RPC_HTTP_METHOD = 'POST'; // e.g. POST /rpc/Users.GetDetails

type ClassCtor = Function;
type ClassMethodName = string;

interface RequestContext {
  req: http.IncomingMessage;
  body?: string; // replaces the HTTP POST body
}

interface ParamDepResolver<T> {
  name: string;
  resolve(ctx: RequestContext): Promise<T> | T;
}

class RpcMethodInfo {
  rpcMethodName: string = '';
  argDeps: ParamDepResolver<any>[] = [];
  result: rttv.Validator<any>;
}

let rpcMethodTags = new Map<ClassCtor, Map<ClassMethodName, RpcMethodInfo>>();

interface RpcHandler {
  target: any;
  instance: any;
  classMethodName: string;
  methodInfo: RpcMethodInfo;
  nRequests: qps.QPSMeter;
  nReqErrors: qps.QPSMeter;
  nReqTime: qps.QPSMeter;
}

let rpcHandlers = new Map<string, RpcHandler>();

function getMethodTags(proto, classMethodName: string) {
  let tags = rpcMethodTags.get(proto);
  if (!tags) rpcMethodTags.set(proto, tags = new Map);
  let info = tags.get(classMethodName);
  if (!info) tags.set(classMethodName, info = new RpcMethodInfo);
  return info;
}

/** e.g. @rpc.Service('FooBar') */
export function Service(rpcServiceName: string) {
  return function decorate(target) {
    if (!target.name)
      throw new Error('@rpc.Service cannot be used with anon classes');

    let tags = rpcMethodTags.get(target.prototype);
    if (!tags) throw new Error(
      '@rpc.Service cannot be used without @rpc.Method');

    for (let [classMethodName, methodInfo] of tags) {
      let { rpcMethodName } = methodInfo;
      let rpcid = rpcServiceName + '.' + rpcMethodName;
      let urlPattern = `/rpc/${rpcid}`;
      log.i(target.name + '.' + classMethodName, ':', urlPattern);
      let qpsNamePrefix = 'rpc.' + rpcid;
      let nRequests = qps.register(qpsNamePrefix + '.reqs', 'qps');
      let nReqErrors = qps.register(qpsNamePrefix + '.errs', 'qps');
      let nReqTime = qps.register(qpsNamePrefix + '.time', 'avg');


      rpcHandlers.set(rpcid, {
        target,
        instance: null,
        classMethodName,
        methodInfo,
        nRequests,
        nReqErrors,
        nReqTime,
      });

      registerHandler(RPC_HTTP_METHOD, urlPattern, async req => {
        let json = await invoke(rpcid, req);
        return json === undefined ? {} : { json };
      });
    }
  };
}

export async function invoke(
  rpcid: string,
  req: http.IncomingMessage,
  body?: string) {

  let reqid = '[' + getRequestId(req) + ']';
  log.i(reqid, rpcid);
  let r = rpcHandlers.get(rpcid);
  if (!r) throw new NotFound('Bad RPC');
  let time = Date.now();

  try {
    r.instance = r.instance || new r.target;
    r.nRequests.add();

    let ctx: RequestContext = { req, body };
    let args = await resolveRpcArgs(ctx, r.methodInfo);
    let resp = await r.instance[r.classMethodName](...args);
    if (resp === undefined)
      log.v(reqid, '->');
    else
      log.v(reqid, '->', resp);
    let type = r.methodInfo.result;
    type && type.verifyInput(resp);
    return resp;
  } catch (err) {
    log.w(reqid, err);
    r.nReqErrors.add();
    throw err;
  } finally {
    r.nReqTime.add(Date.now() - time);
  }
}

async function resolveRpcArgs(ctx: RequestContext, info: RpcMethodInfo) {
  let reqid = '[' + getRequestId(ctx.req) + ']';
  let args = [];
  for (let i = 0; i < info.argDeps.length; i++) {
    let { name, resolve } = info.argDeps[i];
    log.v(reqid, `Resolving arg #${i} with ${name}.`);
    args[i] = resolve ? await resolve(ctx) : null;
  }
  return args;
}

/** e.g. @rpc.Method('GetData') */
export function Method(rpcMethodName: string, result: rttv.Validator<any>) {
  return function decorate(proto, classMethodName: string) {
    let info = getMethodTags(proto, classMethodName);
    info.rpcMethodName = rpcMethodName;
    info.result = result;
  };
}

/** e.g. @rpc.ParamDep(req => req.headers.foo) */
export function ParamDep<T>(name: string, resolve: ParamDepResolver<T>['resolve']) {
  return function decorate(proto, method: string, paramId: number) {
    let info = getMethodTags(proto, method);
    info.argDeps[paramId] = { name, resolve };
  };
}

export function HttpReq() {
  return ParamDep('HttpReq', ctx => ctx.req);
}

export function ReqBody<T>(validator?: rttv.Validator<T>) {
  return ParamDep<T>('ReqBody', async ctx => {
    let json = ctx.body !== undefined ? ctx.body :
      await downloadRequestBody(ctx.req);
    let reqid = '[' + getRequestId(ctx.req) + ']';
    log.v(reqid, 'RPC request body:', json);
    try {
      let args = JSON.parse(json);
      if (validator) {
        log.v(reqid, 'Validating RPC args.');
        for (let report of validator.validate(args)) {
          log.v(reqid, 'RPC args error:', report.toString());
          throw new TypeError('Invalid RPC args: ' + report);
        }
      }
      return args;
    } catch (err) {
      throw new BadRequest('Bad JSON', err.message);
    }
  });
}
