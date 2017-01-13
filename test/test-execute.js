const {expect, assert} = require ('chai');
const {executeAll} = require('../src/execute');
const {FakeConfigHost} = require ('./test-helpers/FakeConfigHost');
const path = require ('path');

describe("execute", ()=>{
    it('should execute a simple command', ()=>{
        const spawnBehaviors = {
            // Make "simple" command exit 0 and output nothing to stdout.
            // wasKilled is to be read afterwards.
            "simple": {exitCode: 0, stdout: [], wasKilled: false}
        };
        const host = new FakeConfigHost({
            dir: "/package/root",
            taskSet: {default: ["simple command"]},
            tasksToRun: ["default"],
            watchMode: false,
            env: {FOO: "bar"}
        }, spawnBehaviors);

        return executeAll(host).then(()=>{
            expect(host.commandLog).to.deep.equal([
                {
                    cmd: "simple",
                    args: ["command"],
                    options: {
                        cwd: "/package/root",
                        env: {FOO: "bar"}
                    }
                }
            ]);
            expect(host.consoleLog).to.deep.equal([
                "just-build default done."
            ]);
            assert(!spawnBehaviors.simple.wasKilled, "Shouldn't have been killed");
        });
    });

    it('should execute several commands, modify env and change directory', ()=>{
        const spawnBehaviors = {
            // Make "simple" command exit 0 and output nothing to stdout.
            // wasKilled is to be read afterwards.
            "one": {exitCode: 0, stdout: []},
            "two": {exitCode: 0, stdout: []},
            "three": {exitCode: 0, stdout: []},
        };
        const host = new FakeConfigHost({
            dir: "/package/root",
            taskSet: {default: [
                "#Just a comment line",
                "one command to execute",
                "NODE_ENV=production",
                "two",
                "cd subfolder",
                "three 'commands to fake'"
            ]},
            tasksToRun: ["default"],
            watchMode: false,
            env: {FOO: "bar"}
        }, spawnBehaviors);

        return executeAll(host).then(()=>{
            expect(host.commandLog).to.deep.equal([
                {
                    cmd: "one",
                    args: ["command", "to", "execute"],
                    options: {
                        cwd: "/package/root",
                        env: {FOO: "bar"}
                    }
                },
                {
                    cmd: "two",
                    args: [],
                    options: {
                        cwd: "/package/root",
                        env: {FOO: "bar", NODE_ENV: "production"}
                    }
                },
                {
                    cmd: "three",
                    args: ["commands to fake"],
                    options: {
                        cwd: path.resolve("/package/root", "subfolder"), // on windows c:\package\root\subfolder.
                        env: {FOO: "bar", NODE_ENV: "production"}
                    }
                }                
            ]);
            assert(!spawnBehaviors.one.wasKilled, "Shouldn't have been killed");
            assert(!spawnBehaviors.two.wasKilled, "Shouldn't have been killed");
            assert(!spawnBehaviors.three.wasKilled, "Shouldn't have been killed");
        });
        
    });
});
