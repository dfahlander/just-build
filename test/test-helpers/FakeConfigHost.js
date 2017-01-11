const {assert} = require ('chai');
const {extend} = require('../../src/extend');

class FakeConfigHost {
    constructor (template, spawnBehaviours) {
        extend(this, template);
        this.spawnBehaviours = spawnBehaviours;
        this.commandLog = [];
        this.consoleLog = [];
    }
    
    spawn (cmd, args, options) {
        // Push the given commands to our array.
        this.commandLog.push({cmd, args, options});
        const behavior = this.spawnBehaviours[cmd] || {exitCode: 0, stdout: [], wasKilled: false};
        // Return a fake ChildProcess:
        return {
            on (event, cb) {
                assert (event === 'exit' || event === 'error', "Mockup only supports 'error' and 'exit' events");
                
                if (event === 'exit') {
                    // Fake that the process exits successfully immediately.
                    setImmediate(cb.bind(null, behavior.exitCode));
                }
            },
            stdout: {
                on (event, cb) {
                    assert(event === "data", "The mockup only supports 'data' events.");
                    setImmediate(()=>behavior.stdout.forEach(msg => cb(msg)));
                }
            },
            kill () {
                behavior.wasKilled = true;
            }
        }
    }

    log (message) {
        this.consoleLog.push(message);
    }
}

module.exports = {FakeConfigHost};
