import { VFS_VMAP_DIR } from '../conf';
import { getGpsPtr } from '../gpsptr';
import * as rpc from '../rpc';
import * as rttv from '../rttv';
import * as vfs from '../vfs';

const tLatLon = rttv.Dictionary({
  lat: rttv.lat,
  lon: rttv.lon,
});

const tVisitors = rttv.keyval({
  key: rttv.uid,
  val: rttv.anything,
});

@rpc.Service('Map')
class RpcMap {
  @rpc.Method('GetVisitors', tVisitors)
  async visitors(
    @rpc.ReqBody(tLatLon) { lat, lon }: typeof tLatLon.input)
    : Promise<typeof tVisitors.input> {

    let gpsptr = getGpsPtr(lat, lon);
    let vfspath = VFS_VMAP_DIR + '/' + gpsptr.toString('hex');
    let visitors = vfs.root.get(vfspath);
    let result = {};

    for (let uid in visitors)
      result[uid] = true;

    return result;
  }
}
