const { Observable } = require ('../bundledExternals/bundle');
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
        watchMode: boolean,
        spawn: Function,
        env: Object,
        log: Function
    }} Configuration to execute
 */
function executeAll (cfg) {
    return new Promise ((resolve, reject) => {
        let taskWatcher = createTaskExecutor (cfg);
        // Execute them all and handle each watch wakeup.
        taskWatcher.subscribe({
            next ({command, exitCode}) {
                if (exitCode == 0)
                    cfg.log(`just-build ${cfg.tasksToRun.join(',')} done.`);
                else 
                    cfg.log(`just-build ${cfg.tasksToRun.join(',')} failed. '${command}' returned ${exitCode}`);
            },
            error (err) {
                reject(err);
            },
            complete () {
                resolve();
            }
        });
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
        watchMode: boolean,
        spawn: Function,
        env: Object,
        log: Function
    }} Configuration to execute
   @returns Observable
 */
function createTaskExecutor (cfg) {
    let allCommands = [];

    cfg.tasksToRun.forEach(taskName => {
        var commands = cfg.taskSet[taskName];
        if (!commands) throw new Error(`No such task: ${taskName}`);
        allCommands = allCommands.concat(commands);
    });
    
    const source = Observable.from([{
        cwd: cfg.dir,
        env: cfg.env,
        exitCode: 0
    }]);

    return allCommands.reduce((prev, command) => createCommandExecutor(command, prev, cfg), source);
}

/**
 * @param command {string} Command line to execute
 * @param prevObservable {Observable} Observable source to get values from
 * @param hostCfg {{
        watchMode: boolean,
        spawn: Function,
        log: Function
    }} Host and Configuration.
 */
function createCommandExecutor (command, prevObservable, hostCfg) {
    let [cmd, ...args] = tokenize (command);

    return new Observable (observer => {
        var prevComplete = false;
        var process = null;
        var processComplete = false;

        var prevSubscription = prevObservable.subscribe({
            next (envProps) {
                if (envProps.exitCode) {
                    // Previous process exited with non-zero.
                    // Should not continue flow. Instead, forward the error all the
                    // way to the end listener. Note: This may happen several times and does not
                    // mean that observable.error() should be called. Reason: error means the end
                    // of the whole stream while this is not nescessarily so, as a source may be
                    // continously watching while a subsequent process failed to do it's job.
                    observer.next(envProps);
                    return;
                }
                if (process) {
                    // Expects us to re-execute the command. If already executed 
                    try {
                        process.kill();
                    } catch(err) {
                        console.error(`Failed to kill '${command}'. Error: ${err}`);
                    }
                    process = null;
                    processComplete = false;
                }
                try { // Don't know if we're required to do try..catch here or if the framework does that for us. Read/test es-observable contract!
                    if (!cmd) {
                        // Comment or empty line. ignore.
                        observer.next(clone(envProps, {
                            command: command,
                            exitCode: 0
                        }));
                    } else if (cmd === 'cd') {
                        // cd
                        const newDir = path.resolve(envProps.cwd, args[0]);
                        observer.next(clone(envProps, {
                            command: command,
                            exitCode: 0,
                            cwd: newDir,
                        }));
                    } else if (cmd.indexOf('=') !== -1 || args.length > 0 && args[0].indexOf('=') === 0) {
                        // ENV_VAR = value, ENV_VAR=value, ENV_VAR= value or ENV_VAR =value.
                        const statement = args.length > 0 ?
                            args[0] === '=' ?
                                cmd + args[0] + args[1] :
                                cmd + args[0] :
                            cmd;
                        const [variable, value] = statement.split('=');
                        const newEnv = clone(envProps.env);
                        newEnv[variable] = value;
                        observer.next(clone(envProps, {
                            command: command,
                            exitCode: 0,
                            env: newEnv
                        }));
                    } else {
                        // Ordinary command
                        let {refinedArgs, grepString, useWatch} = refineArguments(args, hostCfg.watchMode, command);
                        process = (hostCfg.spawn)(
                            cmd,
                            refinedArgs, {
                                cwd: envProps.cwd,
                                env: envProps.env
                            });

                        process.on('error', err => observer.error(err));
                        if (useWatch) {
                            process.stdout.on('data', data => {
                                if (data.indexOf(grepString) !== -1) {
                                    observer.next(clone(envProps, {
                                        command: command,
                                        exitCode: undefined
                                    }));
                                }
                            });
                        }
                        process.on('exit', code => {
                            process = null;
                            processComplete = true;
                            observer.next(clone(envProps, {
                                command: command,
                                exitCode: code
                            }));
                            if (prevComplete)
                                observer.complete();
                        });
                    }
                    
                } catch (err) {
                    // Don't know if we're required to call setImmediate() here or if the framework does that for us. Read/test es-observable contract!
                    setImmediate(()=>observer.error(err));
                }
            },
            error(err) {
                observer.error(err);
            },
            complete() {
                prevComplete = true;
                if (processComplete)
                    observer.complete();
            }
        })

        return {
            unsubscribe () {
                if (process) {
                    try {
                        process.kill();
                    }
                    catch (err) {
                        console.error(`Failed to kill '${command}'. Error: ${err}`);
                    };
                    process = null;
                }
                prevSubscription.unsubscribe();
            },
            get closed() {
                return !process && prevSubscription.closed;
            }
        }
    });
}

/**
 * Takes an array of arguments and removes "[--watch ...]" if not watchMode. Otherwise,
 * includes "--watch".
 * 
 * @returns {{
 *  refinedArgs: string,
 *  grepString: string,
 *  useWatch: boolean
 * }} Returns the refined arguments together with the grepString to watch for in case useWatch is true.
 */
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
