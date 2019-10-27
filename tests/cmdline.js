const cmdline = require('commander');

cmdline
  .option('-v, --verbose', 'verbose logging')
  .option('-p, --profile', 'CPU profiling')
  .option('-t, --timeout <n>', 'timeout in seconds', 10)
  .parse(process.argv);

let args = {
  verbose: cmdline.verbose || false,
  profile: cmdline.profile || false,
  timeout: +cmdline.timeout,
};

module.exports = args;
