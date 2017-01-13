const {expect, assert} = require ('chai');
const {executeAll} = require('../src/execute');
const {FakeConfigHost} = require ('./test-helpers/FakeConfigHost');
const path = require ('path');

describe("execute", ()=>{
    it('should execute a simple command', ()=>{
        const spawnBehaviors = {
            // Make "simple" command exit 0 and output nothing to stdout.
            "simple": {exitCode: 0, stdout: []}
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
            expect(host.killLog).to.deep.equal([], "Shouldn't have been killed");
        });
    });

    it('should execute several commands, modify env and change directory', ()=>{
        const spawnBehaviors = {
            // Make "simple" command exit 0 and output nothing to stdout.
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
            expect(host.killLog).to.deep.equal([], "Shouldn't have been killed");
        });
        
    });

    it('should execute a watching command and two remaining simple commands', ()=>{
        const spawnBehaviors = {
            // Make "simple" command exit 0 and output nothing to stdout.
            "watcher": {hang: true, stdout: ["some debug output", "Compilation complete.", "some warning", "Compilation complete."]},
            "two": {exitCode: 0, stdout: []},
            "three": {exitCode: 0, stdout: []},
        };
        const host = new FakeConfigHost({
            dir: "/",
            taskSet: {default: [
                "watcher a b c [--watch 'Compilation complete']",
                "two",
                "three"
            ]},
            tasksToRun: ["default"],
            watchMode: true,
            env: {}
        }, spawnBehaviors);


        executeAll(host);
        
        return new Promise(resolve => {
            let intervalHandle = setInterval (()=>{
                if (host.consoleLog.filter(line => line === 'just-build default done.').length === 2) {
                    clearInterval(intervalHandle);
                    resolve();
                }
            }, 50);
        }).then(()=>{
            expect(host.commandLog).to.deep.equal([
                {
                    cmd: "watcher",
                    args: ["a", "b", "c", "--watch"],
                    options: {cwd: "/", env: {}}
                },
                {
                    cmd: "two",
                    args: [],
                    options: {cwd: "/", env: {}}
                },
                {
                    cmd: "three",
                    args: [],
                    options: {cwd: "/", env: {}}
                },
                {
                    cmd: "two",
                    args: [],
                    options: {cwd: "/", env: {}}
                },
                {
                    cmd: "three",
                    args: [],
                    options: {cwd: "/", env: {}}
                }                
            ]);
            expect(host.killLog).to.deep.equal([], "Shouldn't have been killed");
        });
    });

    it('should not execute remaining commands if a command fails with error exit code', ()=>{
        const spawnBehaviors = {
            // Make "simple" command exit 0 and output nothing to stdout.
            "one": {exitCode: 1, stdout: []},
            "two": {exitCode: 0, stdout: []},
            "three": {exitCode: 0, stdout: []},
        };
        const host = new FakeConfigHost({
            dir: "/",
            taskSet: {default: [
                "one",
                "two",
                "three"
            ]},
            tasksToRun: ["default"],
            watchMode: false,
            env: {}
        }, spawnBehaviors);


        return executeAll(host).catch(()=>{}).then(()=>{
            expect(host.commandLog).to.deep.equal([
                {
                    cmd: "one",
                    args: [],
                    options: {cwd: "/", env: {}}
                }                
            ]);
            expect(host.killLog).to.deep.equal([], "Shouldn't have been killed");
        });
    });
    

    it('should execute two different watching commands with remaining simple commands and be able to watch them in parallell', ()=>{
    });

    it('should cancel subsequent processes whenever main watcher emits another value', ()=>{

    });
});
