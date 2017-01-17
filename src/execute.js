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
    const {dir, taskSet, tasksToRun, watchMode, spawn, env, log} = cfg;

    return Promise.all(tasksToRun.map(taskName =>
        new Promise((resolve, reject) => {
            const commandList = taskSet[taskName];
            if (!commandList)
                throw new Error (`No such task name: ${taskName} was configured`);

            const observable = createSequencialCommandExecutor (
                commandList,
                dir,
                env,
                watchMode,
                {spawn, log});
            
            observable.subscribe({
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
        })
    ));
}

/** 
 * Create an Observable that would execute a sequence of commands.
 *
 * @param commands {string[]} A sequence of commands to execute
 * @param workingDir {string} Initial Working Directory
 * @param envVars {Object} Initial environment variables
 * @param watchMode {boolean} Whether to execute watchers or not
 * @param host {{spawn: Function, log: Function}} Mockable host environment (mimicking child_process.spawn() and console.log())
   @returns Observable
 */
function createSequencialCommandExecutor (commands, workingDir, envVars, watchMode, host) {
    const source = Observable.from([{
        cwd: workingDir,
        env: envVars,
        exitCode: 0
    }]);

    return commands.reduce((prev, command) =>
        createCommandExecutor(command, prev, watchMode, host), source);
}


/**
 * @param command {string} Command line to execute
 * @param prevObservable {Observable} Observable source to get values from
 * @param watchMode {boolean} Whether to invoke --watch argument 
 * @param host {{
        spawn: Function,
        log: Function
    }} Host and Configuration.
 */
function createCommandExecutor (command, prevObservable, watchMode, host) {
    let [cmd, ...args] = tokenize (command);

    return new Observable (observer => {
        var prevComplete = false;
        var process = null;

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
                    if (prevComplete) observer.complete();
                    return;
                }
                if (process) {
                    // We've created a process as a response to a previous next().
                    // We are expected to re-execute the command.
                    try {
                        process.kill('SIGTERM'); // Or should we use SIGINT ('CTRL-C')
                    } catch(err) {
                        console.error(`Failed to kill '${command}'. Error: ${err}`);
                    }
                    process = null;
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
                        let {refinedArgs, grepString, useWatch} = refineArguments(args, watchMode, command);
                        process = (host.spawn)(
                            cmd,
                            refinedArgs, {
                                cwd: envProps.cwd,
                                env: envProps.env
                            });

                        process.on('error', err => observer.error(err)); // Correct? Or just 
                        if (useWatch) {
                            process.stdout.on('data', data => {
                                if (data.indexOf(grepString) !== -1) {
                                    observer.next(clone(envProps, {
                                        command: command,
                                        exitCode: undefined // No real exit code yet. Handled as exitCode 0.
                                    }));
                                }
                            });
                        }
                        process.on('exit', code => {
                            process = null;
                            observer.next(clone(envProps, {
                                command: command,
                                exitCode: code
                            }));
                            if (prevComplete) observer.complete();
                        });
                    }
                    
                } catch (err) {
                    observer.error(err);
                }
            },
            error(err) {
                observer.error(err);
            },
            complete() {
                prevComplete = true;
                if (!process) observer.complete();
            }
        })

        return {
            unsubscribe () {
                if (process) {
                    try {
                        process.kill('SIGTERM'); // Or should we use 'SIGINT' (CTRL-C) ?
                    }
                    catch (err) {
                        console.error(`Failed to kill '${command}'. Error: ${err}`);
                    };
                    /* Should we remove "exit", "error" and "data" listeners?
                    if (process.removeListener) {
                        if (process.stdout.removeListener) {
                            
                        }
                    }
                    */                        
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
