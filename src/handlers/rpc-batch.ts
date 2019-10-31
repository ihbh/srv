import * as auth from '../auth';
import rlog from '../log';
import * as rpc from '../rpc';
import * as rttv from '../rttv';
import * as http from 'http';

const log = rlog.fork('batch');

const tBatchDef = rttv.dict({
  name: rttv.str(/^[a-z]+\.[a-z]+$/i),
  args: rttv.json,
});

const tBatchRes = rttv.list(
  rttv.subset({
    res: rttv.anything,
    err: rttv.dict({
      code: rttv.anything,
      status: rttv.anything,
      description: rttv.anything,
    }),
  })
);

const BatchReq = rttv.list(tBatchDef);

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

    let ps = rpcdefs.map(async ({ name, args }, index) => {
      try {
        let json = JSON.stringify(args);
        let res = await rpc.invoke(name, req, json);
        results[index] = res === undefined ? {} : { res };
      } catch (err) {
        log.v(name, 'failed:', err);
        results[index] = {
          err: {
            code: err.code,
            status: err.status,
            description: err.description,
          }
        };
      }
    });

    await Promise.all(ps);
    return results;
  }
}
