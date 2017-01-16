const {getPackageRoot} = require ('./dirutils');
const {executeAll} = require ('./execute');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

function main (args) {
    const cfg = extractConfig(args);
    return executeAll (cfg);
}

/* TODO:
 * Tweak tests to test things in single task but parallell.
 V Change how executeAll() executes several tasks. Promise.all() instead.
 V Set env to include node_modules/.bin if not already included.
 * Pipe stdout and stderr to us for all processes.
*/

function extractConfig (args) {
    args = args.slice(2);
    const pkg = getPackageOption(args) || process.cwd();
    const pkgIsDir = fs.lstatSync(pkg).isDirectory();
    const pkgDir = pkgIsDir ? pkg : path.dirname(pkg);
    const packageRoot = getPackageRoot(pkgDir);
    if (!packageRoot)
        throw new Error(`Could not find npm package in ${pkgDir}`);
    const configFile = pkgIsDir ?
        path.resolve(packageRoot, 'package.json') :
        pkg;
    if (!fs.exists(configFile))
        throw new Error(`File not found: ${configFile}`);

    const cfg = JSON.parse(fs.readFileSync(configFile));

    const taskSet = cfg["just-build"];
    if (!taskSet)
        throw new Error (`"just-build" attribute missing in ${configFile}`);

    if (typeof taskSet !== 'object')
        throw new Error (`"just-build" attribute not an object in ${configFile}`);

    let tasksToRun = args.filter(arg => arg.indexOf('-') !== 0);
    if (tasksToRun.length === 0) {
        if (!taskSet["default"])
            throw new Error (`No default task exists in ${configFile}`);
        tasksToRun = ["default"];
    }

    // Make sure packageRoot/node_modules/.bin is part of PATH.
    let PATH = process.env.PATH || "";
    const node_modules_bin = path.resolve(packageRoot, 'node_modules/.bin');
    if (PATH.indexOf(`node_modules${path.sep}.bin`) === -1) {
        PATH = `${PATH}${path.delimiter}${node_modules_bin}`;
    }

    return {
        dir: packageRoot,
        taskSet: taskSet,
        tasksToRun: tasksToRun,
        watchMode: args.some(arg => arg === '--watch' || arg === '-w'),
        spawn: child_process.spawn,
        env: process.env,
        log(...args) {
            console.log(...args);
        }
    };
}

function getPackageOption(args) {
    let idxPackage = args.indexOf('--package');
    if (idxPackage === -1) idxPackage = args.indexOf('-p');
    if (idxPackage >= 0 && idxPackage + 1 < args.length) {
        return args[idxPackage + 1];
    }
    return null;
}

module.exports = { main };
