import * as auth from '../auth';
import { log } from '../log';
import * as rpc from '../rpc';
import * as rttv from '../rttv';
import * as http from 'http';

const tBatchDef = rttv.Dictionary({
  name: rttv.RegEx(/^[a-z]+\.[a-z]+$/i),
  args: rttv.json,
});

const tBatchRes = rttv.ArrayOf(
  rttv.subset({
    res: rttv.anything,
    err: rttv.Dictionary({
      code: rttv.anything,
      status: rttv.anything,
      description: rttv.anything,
    }),
  })
);

const BatchReq = rttv.ArrayOf(tBatchDef);

@rpc.Service('Batch')
class RpcBatch {
  @rpc.Method('Run', tBatchRes)
  async run(
    @auth.OptionalUserId() uid: string,
    @rpc.HttpReq() req: http.IncomingMessage,
    @rpc.ReqBody(BatchReq) rpcdefs: typeof BatchReq.input)
    : Promise<typeof tBatchRes.input> {

    log.v(`Running a batch of RPCs for uid=${uid}:`, rpcdefs.length);
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
