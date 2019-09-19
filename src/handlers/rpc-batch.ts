import * as auth from '../auth';
import { log } from '../log';
import * as rpc from '../rpc';
import * as val from '../scheme';
import * as http from 'http';

const BatchDef = val.Dictionary({
  name: val.RegEx(/^[a-z]+\.[a-z]+$/i),
  args: val.json,
});

const BatchReq = val.ArrayOf(BatchDef);

@rpc.Service('Batch')
class RpcBatch {
  @rpc.Method('Run')
  async run(
    @auth.RequiredUserId() uidstr: string,
    @rpc.HttpReq() req: http.IncomingMessage,
    @rpc.ReqBody(BatchReq) rpcdefs: typeof BatchReq.input) {

    log.v(`Running a batch of RPCs for ${uidstr}:`, rpcdefs.length);
    let results = [];

    for (let { name, args } of rpcdefs) {
      try {
        let json = JSON.stringify(args);
        let res = await rpc.invoke(name, req, json);
        results.push(res === undefined ? {} : { res });
      } catch (err) {
        log.v(name, 'failed:', err);
        results.push({
          err: {
            code: err.code,
            status: err.status,
            description: err.description,
          }
        });
      }
    }

    return results;
  }
}
