const {assert} = require ('chai');
const {extend} = require('../../src/extend');

class FakeConfigHost {
    constructor (template, spawnBehaviours) {
        extend(this, template);
        this.spawnBehaviours = spawnBehaviours;
        this.commandLog = [];
        this.consoleLog = [];
        this.killLog = [];
        this.pidCounter = 0;
    }
    
    spawn (cmd, args, options) {
        // Push the given commands to our array.
        this.commandLog.push({cmd, args, options});
        const behavior = this.spawnBehaviours[cmd] || {exitCode: 0, stdout: []};
        const consoleLog = this.consoleLog;
        const killLog = this.killLog;
        const pid = ++this.pidCounter;
        console.log(`\t[${pid}]: ${cmd} ${args.join(' ')}`)
        // Return a fake ChildProcess:
        return {
            on (event, cb) {
                assert (event === 'exit' || event === 'error', "Mockup only supports 'error' and 'exit' events");
                
                if (event === 'exit') {
                    if (!behavior.hang) {
                        // Fake that the process exits successfully immediately.
                        setImmediate(cb.bind(null, behavior.exitCode));
                    }
                }
            },
            stdout: {
                on (event, cb) {
                    assert(event === "data", "The mockup only supports 'data' events.");
                    const messages = behavior.stdout.slice();
                    const sendNextMessage = () => {
                        const msg = messages.shift();
                        console.log("\t" + msg);
                        consoleLog.push(msg);
                        cb(msg);
                        if (messages.length > 0)
                            setTimeout(sendNextMessage, 100);
                    }
                    if (messages.length > 0)
                        setTimeout(sendNextMessage, 100);
                }
            },
            kill () {
                console.log(`[${pid}] was killed.`);
                killLog.push(pid);
            },
            pid: pid
        }
    }

    log (message) {
        console.log("\t" + message);
        this.consoleLog.push(message);
    }
}

module.exports = {FakeConfigHost};
