const {spawn, fork} = require('child_process');
const {surroundWithQuotes} = require('./tokenize');
const {whichLocal} = require ('./which-local');
const path = require('path');
const fs = require('fs');

function spawnOrFork (cmd, args, {cwd, env}) {
    const locallyInstalledBinaryModuleEntry = whichLocal (cmd, cwd);
    if (locallyInstalledBinaryModuleEntry) {
        // Use fork instead of spawn to save resources.
        const relativeBinPath = path.relative(cwd, locallyInstalledBinaryModuleEntry);
        console.log(`(node)> ${cmd} ${args.join(' ')}`);
        return fork(locallyInstalledBinaryModuleEntry, args, {
            cwd,
            env,
            silent: true
        });
    } else if (cmd === "node" && fs.existsSync(path.resolve(cwd, args[0]))) {
        console.log(`(node)> ${args[0]} ${args.slice(1).join(' ')}`);
        return fork(args[0], args.slice(1), {
            cwd,
            env,
            silent: true
        });
    } else {
        //console.log(`Using spawn: ${cmd}`)
        cmd = surroundWithQuotes(cmd);
        args = args.map(surroundWithQuotes);
        console.log(`> ${cmd} ${args.join(' ')}`);
        return spawn(cmd, args, {
            cwd,
            env,
            shell: true
        });
    }
}

module.exports = { spawnOrFork };

