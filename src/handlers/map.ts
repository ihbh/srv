import * as auth from '../auth';
import { log } from '../log';
import * as rpc from '../rpc';
import * as val from '../val';

interface RpcShareLocation {
  lat: number;
  lon: number;
  time: number;
}

interface RpcGetPeopleNearby {
  lat: number;
  lon: number;
}

let Lat = val.MinMax(-90, 90);
let Lon = val.MinMax(-180, 180);

let RpcShareLocation = val.Dictionary({
  lat: Lat,
  lon: Lon,
  time: val.MinMax(
    new Date('2019-09-01').getTime() / 1000 | 0,
    new Date('2099-09-01').getTime() / 1000 | 0),
});

let RpcGetPeopleNearby = val.Dictionary({
  lat: Lat,
  lon: Lon,
});

@rpc.Service('Map')
class RpcMap {
  @rpc.Method('ShareLocation')
  async add(
    @auth.RequiredUserId() user: string,
    @rpc.ReqBody(RpcShareLocation) body: RpcShareLocation) {
    
    log.v('Sharing location:', user, body);
  }

  @rpc.Method('GetPeopleNearby')
  async get(
    @rpc.ReqBody(RpcGetPeopleNearby) body: RpcGetPeopleNearby) {

    log.v('Getting people nearby', body);
  }
}
