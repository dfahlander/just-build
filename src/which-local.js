const path = require('path');
const fs = require('fs');
const {getPackageRoot, getBinLocation} = require('./dirutils');
const {tokenize, surroundWithQuotes} = require('./tokenize');

function whichLocal (cmd, cwd) {
    console.debug(`whichLocal(${JSON.stringify(cwd)}, ${JSON.stringify(cmd)})`);
    const binScript = getBinLocation(cwd, cmd);
    console.debug(`binScript = ${JSON.stringify(binScript)}`);
    if (!binScript) return null;
    const binDir = path.dirname (binScript);
    console.debug(`binDir = ${JSON.stringify(binDir)}`);
    const node_modules = path.normalize(path.resolve(binDir, ".."));
    console.debug(`node_modules = ${JSON.stringify(node_modules)}`);

    if (!fs.existsSync(binScript)) return null;

    const scriptLines = fs.readFileSync(binScript, "utf-8").split('\n');
    if (scriptLines.length === 0) return null;
    const shebang = scriptLines[0].trim();
    console.debug(`shebang = ${shebang}`);
    if (shebang[0] != "#") return null;
    if (shebang.indexOf("bin/sh") === -1) {
        // Not a shellscript (cygwin starter)
        if (scriptLines[0].indexOf(' node') !== -1) {
            // A node script by itself
            console.debug(`A node script by itself`);
            return path.normalize(binScript);
        }
        console.debug(`whichLocal return null since bin/sh not found in shebang.`);
        return null;
    }
    const invokerLines = scriptLines.filter(line => line.indexOf('node ') !== -1);
    console.debug(`invokerLines = ${JSON.stringify(invokerLines)}`);
    // Expected to find: `  node  "$basedir/../uglify-js/bin/uglifyjs" "$@"`
    if (invokerLines.length < 1) return null;
    const tokenized = tokenize(invokerLines[0]);
    // Expected: "node", "$basedir/../uglify-js/bin/uglifyjs", "$@" or
    //           "exec", "node", "$basedir/../typescript/bin/tsc", "$@" or
    //           "exec", "$basedir/node", "$basedir/../typescript/bin/tsc". "$@""
    if (tokenized.length < 3) return null;
    const binFilePath = tokenized.find(part =>
        part !== 'exec' &&
        part !== 'node' &&
        !part.endsWith('/node')
    );
    let splitted = binFilePath.split('/');
    while (splitted.length > 0 && (
        splitted[0].indexOf('$') === 0 || // $basedir
        splitted[0] === '..' || // ".."
        splitted[0] === '.')) // just for optional future changes
    {
        splitted = splitted.slice(1);
    }

    const jsScriptPath = path.normalize(path.resolve(node_modules, splitted.join('/')));
    console.debug(`jsScriptPath = ${JSON.stringify(jsScriptPath)}`);
    if (splitted.length === 0) return null;
    const moduleName = splitted[0];
    console.debug(`moduleName = ${JSON.stringify(moduleName)}`);
    const packageJson = path.resolve(node_modules, moduleName, "package.json");
    console.debug(`packageJson = ${JSON.stringify(packageJson)}`);
    const binAttribute = JSON.parse(fs.readFileSync(packageJson)).bin;
    console.debug(`binAttribute = ${JSON.stringify(binAttribute)}`);
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
