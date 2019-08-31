import * as fs from 'fs';

const CONF_JSON = './conf.json';

interface GConfig {
  port: number,
  gzip: {
    size: number,
  }
}

const readConfig = (): GConfig =>
  JSON.parse(fs.readFileSync(CONF_JSON, 'utf8'));

export default readConfig();
