const {expect, assert} = require ('chai');
const {executeAll} = require('../src/execute');
const {FakeConfigHost} = require ('./test-helpers/FakeConfigHost');
const { Observable } = require ('../bundledExternals/bundle');
const { Subject } = require ('./test-helpers/subject');
const path = require ('path');

describe("execute", ()=>{
    it('should execute a simple command', ()=>{
        const host = new FakeConfigHost({
            dir: "/package/root",
            taskSet: {default: ["simple command"]},
            tasksToRun: ["default"],
            watchMode: false,
            env: {FOO: "bar"}
        });

        return executeAll(host).then(()=>{
            expect(host.commandLog).to.deep.equal([
                {
                    cmd: 'simple',
                    args: ['command'],
                    options: {
                        cwd: "/package/root",
                        env: {FOO: "bar"},
                        shell: true
                    }
                }
            ]);
            expect(host.consoleLog[0]).to.contain("just-build default done.");
            expect(host.killLog).to.deep.equal([], "Shouldn't have been killed");
        });
    });

    it('should execute several commands, modify env and change directory', ()=>{
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
        });

        return executeAll(host).then(()=>{
            expect(host.commandLog).to.deep.equal([
                {
                    cmd: 'one',
                    args: ['command', 'to', 'execute'],
                    options: {
                        cwd: "/package/root",
                        env: {FOO: "bar"},
                        shell: true
                    }
                },
                {
                    cmd: 'two',
                    args: [],
                    options: {
                        cwd: "/package/root",
                        env: {FOO: "bar", NODE_ENV: "production"},
                        shell: true
                    }
                },
                {
                    cmd: 'three',
                    args: ['commands to fake'],
                    options: {
                        cwd: path.resolve("/package/root", "subfolder"), // on windows c:\package\root\subfolder.
                        env: {FOO: "bar", NODE_ENV: "production"},
                        shell: true
                    }
                }                
            ]);
            expect(host.killLog).to.deep.equal([], "Shouldn't have been killed");
        });
    });

    it('should execute a watching command and two remaining simple commands', ()=>{
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
        }, {openCommandStream: true});

        const executeAllPromise = executeAll(host);

        let watchProcess = null;
        return host.commandStream.next().then(({value, done})=>{
            const {cmd, args, options, process} = value;
            expect(cmd).to.equal('watcher');
            expect(args).to.deep.equal(['a', 'b', 'c', '--watch']);
            watchProcess = process;
            process.stdout.trigger('data', 'some debug output'); // Should not wake up.
            expect(host.commandLog.length).to.equal(1, "Still no extra command triggered");
            process.stdout.trigger('data', 'Compilation complete.');
            return host.commandStream.next();
        }).then(({value, done}) => {
            const {cmd, args, options, process} = value;
            expect(cmd).to.equal('two');
            expect(host.commandLog.length).to.equal(2);
            process.trigger('exit', 0);
            return host.commandStream.next();
        }).then(({value, done}) => {
            const {cmd, args, options, process} = value;
            expect(cmd).to.equal('three');
            expect(host.commandLog.length).to.equal(3);
            assert(!host.consoleLog.includes('just-build default done.'), "Should not yet have fulfilled a complete flow.");
            process.trigger('exit', 0);
            // Now trigger some more output to the watch process again to verify it can reexeute two,three:
            watchProcess.stdout.trigger('data', 'Compilation complete.');
            return host.commandStream.next();
        }).then(({value, done}) => {
            const {cmd, args, options, process} = value;
            assert(host.consoleLog.some(line => line.indexOf('just-build default done.') !== -1), "Should now have completed the flow once");
            expect(cmd).to.equal('two');
            expect(host.commandLog.length).to.equal(4);
            process.trigger('exit', 0);
            return host.commandStream.next();
        }).then(({value, done}) => {
            const {cmd, args, options, process} = value;
            expect(cmd).to.equal('three');
            expect(host.commandLog.length).to.equal(5);
            // Now don't yet exit this process. Instead verify it is killed once the flow is restarted again
            watchProcess.stdout.trigger('data', 'Once again, Compilation complete. This time before three was done.');
            return host.commandStream.next();
        }).then(({value, done}) => {
            expect(host.killLog, "no one killed yet").to.be.empty;
            value.process.trigger('exit', 0); // Exit "two" to trigger the killing of "three"
            return host.commandStream.next();
        }).then(({value, done}) => {
            expect(host.killLog.length).to.equal(1, "Now someone has been killed ('three')");
            value.process.trigger('exit', 0);
            watchProcess.trigger('exit', 1); // Now end the watcher to make the final Promise resolve.
            return executeAllPromise; // Wait for exeuteAll to finally complete.
        }).then(()=>{
            expect(host.consoleLog[host.consoleLog.length-1]).to.contain('just-build default failed.');
        });
    });
});
