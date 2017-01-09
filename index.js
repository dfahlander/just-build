const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const watchMode = args.some(arg => arg == '--watch');

goToPackage();

function goToPackage() {
    const idxPackage = args.indexOf('--package');
    if (idxPackage >= 0 && idxPackage + 1 < args.length) {
        process.chdir(args[idxPackage + 1]);
    } else {
        while (process.cwd().length > 3 && !fs.existsSync("./package.json"))
            process.chdir(path.dirname(process.cwd()));
        if (process.cwd().length <= 3)
            throw new Error("Could not find package root");
    }
}

const config = JSON.parse(fs.readFileSync("package.json", "utf-8"));

console.log("Package name: " + config.name);

