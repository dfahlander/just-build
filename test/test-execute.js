const {expect, assert} = require ('chai');
const {executeAll} = require('../src/execute');
const {FakeConfigHost} = require ('./test-helpers/FakeConfigHost');

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
        });
    });
});
