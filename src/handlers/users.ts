import * as auth from '../auth';
import conf from '../conf';
import KVS from '../kvs';
import { log } from '../log';
import * as rpc from '../rpc';
import * as val from '../val';

let kvsdb = new KVS(conf.dirs.kvs.user);

let UserName = val.RegEx(/^\w{3,20}$/);
let UserPhoto = val.RegEx(/^data:image\/jpeg;base64,\S{1,8000}$/);
let UserInfo = val.AsciiText(1024);
let UserPubKey = val.HexNum(64);

let RpcGetDetails = val.ArrayOf(auth.UserId);
let RpcSetDetails = val.Dictionary({
  name: val.Optional(UserName),
  info: val.Optional(UserInfo),
  photo: val.Optional(UserPhoto),
  pubkey: val.Optional(UserPubKey),
});

@rpc.Service('Users')
class RpcUsers {
  // rpc-test Users.GetDetails '[123,456]'
  @rpc.Method('GetDetails')
  async get(
    @rpc.ReqBody(RpcGetDetails) uids: string[]) {

    log.v('Getting details for', uids);
    return uids.map(uid => {
      let json = kvsdb.get(uid);
      return JSON.parse(json);
    });
  }

  // rpc-test Users.SetDetails '{"name":"Joe"}'
  @rpc.Method('SetDetails')
  async set(
    @auth.RequiredUserId() user: string,
    @rpc.ReqBody(RpcSetDetails) details) {

    log.v('Setting details for', user);
    let json = JSON.stringify(details);
    kvsdb.set(user, json);
  }
}