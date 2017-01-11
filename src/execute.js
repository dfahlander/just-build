const { Observable } = require ('../bundledExternals/bundle');
const { spawn } = require ('child_process');
const path = require ('path');
const { tokenize } = require ('./tokenize');
const { clone } = require ('./extend');

/** 
 * Execute the build tasks.
 * 
 * @param cfg {{
        dir: string,
        taskSet: Object.<string, string[]>,
        tasksToRun: string[],
        watchMode: boolean
    }} Configuration to execute
 */
function executeAll (cfg) {
    let taskWatchers = cfg.tasksToRun.map(taskName => createTaskExecutor (cfg.taskSet[taskName], cfg));
    // Make commands execute sequencial by reducing the observers using Observable.concat()
    let sequencialObserver = taskWatchers.reduce((pw1, pw2) => pw1.concat(pw2));
    // Execute them all and handle each watch wakeup.
    sequencialObserver.subscribe({
        next () {
            if (cfg.tasksToRun.length > 1) {
                // Just output summary done if more than one task was to be executed
                process.stdout.write(`just-build ${cfg.tasksToRun.join(',')} done.\n`);
            }
        },
        error (err) {
            process.stderr.write(`Error: ${err}`);
            process.exit(1);
        },
        complete (err) {
            process.exit(0);
        }
    });
}

/** 
 * Execute the build tasks.
 *
 * @param taskName {string} Name of task to execute 
 * @param cfg {{
        dir: string,
        taskSet: Object.<string, string[]>,
        tasksToRun: string[],
        watchMode: boolean
    }} Configuration to execute
   @returns Observable
 */
function createTaskExecutor (taskName, cfg) {
    let commands = cfg.taskSet[taskName];
    return createChainedCommandExecutor (commands, {
        cwd: cfg.dir,
        env: process.env
    }, cfg);
}

function createChainedCommandExecutor (commands, spawnOptions, cfg) {
    return new Observable(observer => {
        let nextSubscription = null;
        let nextObservable = createCommandExecutor(commands, spawnOptions, cfg);

        function onNext({commands, spawnOptions}) {
            if (commands.length === 0) {
                observer.next();
            } else {
                nextSubscription = createChainedCommandExecutor (commands, spawnOptions, cfg)
                    .subscribe({
                        next: onNext,
                        error: observer.error,
                        complete: observer.complete
                    });
            }
        }
        
        const subscription = nextObservable.subscribe ({
            next: onNext,
            error: observer.error,
            complete: observer.complete
        });

        return {
            unsubscribe () {
                if (nextSubscription) {
                    // Cancel child build-flow.
                    nextSubscription.unsubscribe();
                }
                subscription.unsubscribe();
            },
            get closed() {
                return subscription.closed;
            }
        }
    });
}

/**
 * @param spawnOptions {cwd: string, env: Object}
 */
function createCommandExecutor (commands, spawnOptions, cfg) {
    if (commands.length === 0) {
        // No more commands. Just return a completed observable.
        return new Observable(observer => {
            setImmediate(()=>observer.complete());
            return {
                unsubscribe() {},
                closed: true
            }
        });
    }
    const command = commands[0];
    const remainingCommands = commands.slice(1);
    return new Observable (observer => {
        var childProcess = null;

        try {
            const [cmd, ...args] = tokenize (command);
            if (cmd === "") {
                // Comment or empty line. ignore.
                observer.next({commands: remainingCommands, spawnOptions});
            } else if (cmd === 'cd') {
                // cd
                const newDir = path.resolve(spawnOptions.cwd, args[0]);
                const nextSpawnOptions = clone(spawnOptions, {cwd: newDir});
                observer.next({commands: remainingCommands, spawnOptions: nextSpawnOptions});
            } else if (cmd.indexOf('=') !== -1 || args.length > 0 && args[0].indexOf('=') === 0) {
                // ENV_VAR = value, ENV_VAR=value, ENV_VAR= value or ENV_VAR =value.
                const statement = args[0] === '=' ?
                    cmd + args[0] + args[1] :
                    cmd + args[0];
                const [variable, value] = statement.split('=');
                const newEnv = clone(spawnOptions.env);
                newEnv[variable] = value;
                const nextSpawnOptions = clone(spawnOptions, {env: newEnv});
                observer.next({commands: remainingCommands, spawnOptions: nextSpawnOptions});
            } else {
                // Ordinary command
                let {refinedArgs, grepString, useWatch} = refineArguments(args, cfg.watchMode, command);
                childProcess = spawn (cmd, refinedArgs, spawnOptions);
                childProcess.on('error', err => observer.error(err));
                if (useWatch) {
                    childProcess.stdout.on('data', data => {
                        if (data.indexOf(grepString) !== -1) {
                            observer.next({commands: remainingCommands, spawnOptions});
                        }
                    });
                }
                childProcess.on('exit', code => {
                    if (code === 0) {
                        childProcess.
                        observer.next({commands: remainingCommands, spawnOptions});
                        observer.complete();
                    } else
                        observer.error(new Error(`Command '${command}' returned ${code}`));
                });                    
            }
            
        } catch (err) {
            setImmediate(()=>observer.error(err));
        }

        return {
            unsubscribe () {
                if (childProcess) {
                    try {
                        childProcess.kill();
                        childProcess = null;
                    }
                    catch (err) {
                        console.error(err.stack)
                    };
                }
            },
            get closed() {
                return !childProcess || childProcess.connected;
            }
        }
    });
}

function refineArguments(args, watchMode, commandSource) {
    const refinedArgs = [];
    let hasOptionalWatchArg = false;
    let grepString = null;
    for (let i=0; i<args.length; ++i) {
        let arg = args[i];
        if (arg === '[--watch') {
            hasOptionalWatchArg = true;
            if (watchMode) {
                refinedArgs.push('--watch');
                if (i + 1 >= args.length)
                    throw new Error (`Missing grepString in the following command: "${commandSource}"`);
                grepString = args[i + 1];
            }
            if (i + 2 >= args.length || args[i + 2] !== ']')
                throw new Error (`Missing ']' in the following command: ${commandSource}`);
            i += 2;
        } else {
            refinedArgs.push(arg);
        }
    };
    return {
        refinedArgs,
        grepString: grepString,
        useWatch: hasOptionalWatchArg && watchMode
    };
}

module.exports = {executeAll, refineArguments};
