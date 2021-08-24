const DEBUG = process.argv.some(arg => arg === "--debug");

function log(...args) {
  if (DEBUG) {
    console.debug(...args);
  }
}

module.exports = {
  DEBUG,
  log
};
