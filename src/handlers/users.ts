import * as auth from '../auth';
import conf from '../conf';
import KVS from '../kvs';
import { log } from '../log';
import * as rpc from '../rpc';

let kvsdb = new KVS(conf.dirs.kvs.user);

interface UserDetails {
  name: string;
  info: string;
  photo: string;
  pubkey: string;
}

@rpc.Service('Users')
class RpcUsers {
  // rpc-test Users.GetDetails '[123,456]'
  @rpc.Method('GetDetails')
  async get(
    @rpc.ReqBody() uids: string[]) {

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
    @rpc.ReqBody() details: UserDetails) {

    log.v('Setting details for', user);
    let json = JSON.stringify(details);
    kvsdb.set(user, json);
  }
}
