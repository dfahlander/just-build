const {executeAll} = require ('./execute');
const {extractConfig} = require ('./extract-config');
const {spawn} = require('child_process');
const {extend} = require('./extend');

function main (args) {
    return new Promise(resolve => {
        const cfg = extractConfig(args, {cwd: process.cwd()});
        extend(cfg, {
            env: process.env,
            log(...args) { console.log(...args); },
            spawn
        });
        resolve (executeAll (cfg));
    });
}

module.exports = { main };
