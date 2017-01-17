const {assert} = require('chai');
const {extend} = require('../../src/extend');
const {Subject} = require('./subject');
const {AsyncIterator} = require('./async-iterator');

/**
 * @param template {Object} cfg template to use (dir, env, taskSet, tasksToRun, etc...)
 */
function FakeConfigHost (template, options) {
    const {openCommandStream} = options || {};
    extend(this, template);
    var commandLog = this.commandLog = [];
    var consoleLog = this.consoleLog = [];
    var killLog = this.killLog = [];
    var pidCounter = 0;
    if (openCommandStream) {
        this.commandStream = new AsyncIterator();
    }
    
    this.spawn = (cmd, args, options) => {
        // Push the given commands to our array.
        commandLog.push({cmd, args, options});
        const pid = ++pidCounter;
        console.log(`\t[${pid}]: ${cmd} ${args.join(' ')}`)
        const processErrorEvent = new Subject();
        const processExitEvent = new Subject();
        const stdoutDataEvent = new Subject();

        // Return a fake ChildProcess:
        const process = {
            on (event, cb) {
                assert (event === 'exit' || event === 'error', "Mockup only supports 'error' and 'exit' events");
                
                if (event === 'exit') {
                    processExitEvent.subscribe({next: cb});
                } else if (event === 'error') {
                    processErrorEvent.subscribe({next: cb});
                }
            },
            trigger(event, data) {
                assert (event === 'exit' || event === 'error', "Mockup only supports 'error' and 'exit' events");
                if (event === 'exit') {
                    processExitEvent.next(data);
                } else if (event === 'error') {
                    processErrorEvent.next(data);
                }
            },
            stdout: {
                on (event, cb) {
                    assert(event === "data", "The mockup only supports 'data' events.");
                    stdoutDataEvent.subscribe({
                        next(data) {
                            consoleLog.push(data);
                            cb(data);
                        }
                    });
                },
                trigger(event, data) {
                    assert (event === 'data', "Mockup only supports 'data' events");
                    stdoutDataEvent.next(data);
                },
                pipe(){}
            },
            stderr: {
                pipe(){}
            },
            kill () {
                console.log(`[${pid}] was killed.`);
                killLog.push(pid);
            },
            pid: pid
        };

        if (openCommandStream) {
            // Let user control how the process events should be triggered. Wake up user code
            // to start controlling the process now:
            this.commandStream.push({cmd, args, options, process});
        } else {
            // No detailed control. Assume command should exit immediately with exit code 0.
            setImmediate(()=>process.trigger('exit', 0));
        }

        return process;
    }

    this.log = message => {
        console.log("\t" + message);
        consoleLog.push(message);
    }
}

module.exports = {FakeConfigHost};
