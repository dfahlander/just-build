const path = require('path');
const fs = require('fs');
const {getPackageRoot, getBinLocation} = require('./dirutils');
const {tokenize, surroundWithQuotes} = require('./tokenize');

function whichLocal (cmd, cwd) {
    const binScript = getBinLocation(cwd, cmd);
    if (!binScript) return null;
    const binDir = path.dirname (binScript);
    const node_modules = path.normalize(path.resolve(binDir, ".."));

    if (!fs.existsSync(binScript)) return null;

    const scriptLines = fs.readFileSync(binScript, "utf-8").split('\n');
    if (scriptLines.length === 0) return null;
    const shebang = scriptLines[0].trim();
    if (shebang[0] != "#") return null;
    if (shebang.indexOf("bin/sh") === -1) {
        // Not a shellscript (cygwin starter)
        if (scriptLines[0].indexOf(' node') !== -1) {
            // A node script by itself
            return path.normalize(binScript);
        }
        return null;
    }
    const invokerLines = scriptLines.filter(line => line.indexOf('node ') !== -1);
    // Expected to find: `  node  "$basedir/../uglify-js/bin/uglifyjs" "$@"`
    if (invokerLines.length < 1) return null;
    const tokenized = tokenize(invokerLines[0]);
    // Expected: "node", "$basedir/../uglify-js/bin/uglifyjs", "$@"
    if (tokenized.length < 3) return null;
    let splitted = tokenized[1].split('/');
    while (splitted.length > 0 && (
        splitted[0].indexOf('$') === 0 || // $basedir
        splitted[0] === '..' || // ".."
        splitted[0] === '.')) // just for optional future changes
    {
        splitted = splitted.slice(1);
    }

    const jsScriptPath = path.normalize(path.resolve(node_modules, splitted.join('/')));
    if (splitted.length === 0) return null;
    const moduleName = splitted[0];            
    const packageJson = path.resolve(node_modules, moduleName, "package.json");
    const binAttribute = JSON.parse(fs.readFileSync(packageJson)).bin;
    const configureBinPath = path.resolve(node_modules, moduleName,
        typeof binAttribute === 'string' ?
            binAttribute : // "bin": "bin/cli"
            binAttribute[cmd]); // "bin": {"cmd1": "bin/cmd1", "cmd2": ...}
    
    if (path.normalize(configureBinPath) !== jsScriptPath) {
        console.error(`Warning: fork optimization failed to to a sanity check. ` +
            `Expected '${jsScriptPath} to equal configured bin path `+
            `'${configureBinPath}'`);
        return null;
    }

    return path.normalize(configureBinPath);
}

module.exports = { whichLocal };
