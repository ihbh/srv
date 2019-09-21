// Keeps the list of visited place, per user.
//
// Key: uid, 64 bit
// Value: Map<ts, {lat,lon}>, ts in minutes, 32 bits
//
// The 32 bit ts key will overflow in 135 years.

import conf from './conf';
import KVS from './kvs';
import * as scheme from './scheme';

export type Lat = typeof Lat.input;
export type Lon = typeof Lon.input;
export type VisitedPlace = typeof VisitedPlace.input;
export type VisitedPlaces = typeof VisitedPlaces.input;

export let Lat = scheme.MinMax(-90, 90);
export let Lon = scheme.MinMax(-180, 180);

export let VisitedPlace = scheme.Dictionary({
  lat: Lat,
  lon: Lon,
  // Date.now()/1000, seconds, about 30 bits.
  // Also serves as unique id of this record.
  time: scheme.MinMax(
    Math.round(new Date('2000-1-1').getTime() / 1000),
    Math.round(new Date('2100-1-1').getTime() / 1000)),
});

export let VisitedPlaces = scheme.KeyVal(
  scheme.HexNum(8), // 32 bits, Date.now()/60/1000
  VisitedPlace);

let db = new KVS(conf.dirs.kvs.places);

export default new class {
  get(uid: Buffer): VisitedPlaces {
    let data = db.get(uid);
    let json = data ? data.toString('utf8') : '{}';
    return JSON.parse(json);
  }

  set(uid: Buffer, dict: VisitedPlaces) {
    let json = JSON.stringify(dict);
    db.set(uid, json);
  }
};
