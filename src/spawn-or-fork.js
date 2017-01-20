const {spawn, fork} = require('child_process');
const {surroundWithQuotes} = require('./tokenize');
const {whichLocal} = require ('./which-local');
const path = require('path');
const fs = require('fs');
const clr = require ('./console-colors');

function spawnOrFork (cmd, args, {cwd, env}) {
    const locallyInstalledBinaryModuleEntry = whichLocal (cmd, cwd);
    if (locallyInstalledBinaryModuleEntry) {
        // Use fork instead of spawn to save resources.
        const relativeBinPath = path.relative(cwd, locallyInstalledBinaryModuleEntry);
        console.log(`${clr.DIM}(node)> ${clr.CYAN}${cmd} ${args.join(' ')}${clr.RESET}`);
        return fork(locallyInstalledBinaryModuleEntry, args, {
            cwd,
            env,
            silent: true
        });
    } else if (cmd === "node" && fs.existsSync(path.resolve(cwd, args[0]))) {
        console.log(`${clr.DIM}(node)> ${clr.CYAN}${args[0]} ${args.slice(1).join(' ')}${clr.RESET}`);
        return fork(args[0], args.slice(1), {
            cwd,
            env,
            silent: true
        });
    } else {
        //console.log(`Using spawn: ${cmd}`)
        cmd = surroundWithQuotes(cmd);
        args = args.map(surroundWithQuotes);
        console.log(`${clr.DARK_GRAY}> ${clr.BLUE}${cmd} ${args.join(' ')}${clr.RESET}`);
        return spawn(cmd, args, {
            cwd,
            env,
            shell: true
        });
    }
}

module.exports = { spawnOrFork };

