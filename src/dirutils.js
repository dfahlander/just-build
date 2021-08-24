const path = require('path');
const fs = require('fs');
const debug = require('./debug');

/** Navigates upwards to the closest dir that contains a 'package.json'.
 * @param dir {string} Directory to start from.
 */
function getPackageRoot (dir) {
    debug.log(`getPackageRoot(${JSON.stringify(dir)})`);
    let lastDir = null;
    while (lastDir !== dir && !fs.existsSync(path.resolve(dir, "./package.json"))) {
        lastDir = dir;
        dir = path.dirname(dir);
    }
    return (lastDir === dir ? null : dir);
}

function getBinLocation (dir, bin) {
    let lastDir = null;
    while (lastDir !== dir && !fs.existsSync(path.resolve(dir, "./node_modules/.bin/" + bin))) {
        lastDir = dir;
        dir = path.dirname(dir);
    }
    return (lastDir === dir ? null : path.resolve(dir, "./node_modules/.bin/" + bin));
}

module.exports = {getPackageRoot, getBinLocation};
