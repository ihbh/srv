const cmdline = require('commander');

cmdline
  .option('-v, --verbose', 'verbose logging')
  .option('-t, --timeout <n>', 'timeout in seconds', 10)
  .parse(process.argv);

let args = {
  verbose : cmdline.verbose || false,
  timeout : +cmdline.timeout,
};

console.log('cmd line args:', args);
module.exports = args;
