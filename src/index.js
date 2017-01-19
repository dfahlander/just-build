const {executeAll} = require ('./execute');
const {extractConfig} = require ('./extract-config');
const {spawnOrFork} = require ('./spawn-or-fork');
const {extend} = require('./extend');

function main (args) {
    return new Promise(resolve => {
        const cfg = extractConfig(args, {cwd: process.cwd(), env: process.env});
        extend(cfg, {
            log(...args) { console.log(...args); },
            spawn: spawnOrFork
        });
        resolve (executeAll (cfg));
    });
}

module.exports = { main };
