const { Observable } = require ('../bundledExternals/bundle');
const path = require ('path');
const { tokenize, surroundWithQuotes } = require ('./tokenize');
const { clone } = require ('./extend');
const { extractConfig } = require ('./extract-config');
const { extend } = require('./extend');
const { ColorTransform } = require ('./color-transform');
const clr = require ('./console-colors');
const COMMENT_COLOR = clr.GREEN;
const EMIT_COLOR = clr.GREEN + clr.BOLD;
const NOW_WATCHING_COLOR = clr.MAGENTA;
const SPECIAL_PROMPT_COLOR = clr.DIM;
const COMMAND_COLOR = clr.CYAN;

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
        log: Function,
        packageRoot: string
    }} Configuration to execute
    @return Promise
 */

function executeAll (cfg) {
    console.log(`${clr.DIM+clr.LIGHT_MAGENTA}Package: ${cfg.packageRoot}${clr.RESET}`);
    return new Promise((resolve, reject) => {
        createObservable(cfg).subscribe({
            next ({command, exitCode}) {
                if (exitCode == 0)
                    cfg.log(`${EMIT_COLOR}just-build ${cfg.tasksToRun.join(' ')}`+
                            ` done.${clr.RESET}${cfg.watchMode ? NOW_WATCHING_COLOR+' Still watching...'+clr.RESET : ''}`);
                else {
                    const errText = `just-build ${cfg.tasksToRun.join(' ')} failed. ${command} returned ${exitCode}`;
                    cfg.log(errText);
                    if (!cfg.watchMode) {
                        reject(new Error(errText));
                    }
                }
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
 * Create a build-task executer as an Observable
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
    @return Observable
 */
function createObservable (cfg) {
    const {dir, taskSet, tasksToRun, watchMode, spawn, env, log} = cfg;

    const tasks = tasksToRun.map(taskName => {
        const commandList = taskSet[taskName];
        if (!commandList)
            throw new Error (`No such task name: ${taskName} was configured`);
        return commandList;
    });

    return createParallellCommandsExecutor (
        tasks,
        dir,
        env,
        watchMode,
        {spawn, log});
}

/** 
 * Create an Observable that will execute all tasks in parallell and emit exitCode
 * whenever one of the tasks fails, or whenever all tasks emits successful exit code.
 * If then a command is rerun and complete successfully, it will emit again.
 * The final subscription will complete when (and if) all tasks completes.
 *
 * @param tasks {string[][]} Array of tasks (sequences of commands) to execute
 * @param workingDir {string} Initial Working Directory
 * @param envVars {Object} Initial environment variables
 * @param watchMode {boolean} Whether to execute watchers or not
 * @param host {{spawn: Function, log: Function}} Mockable host environment (mimicking child_process.spawn() and console.log())
   @returns Observable
 */
function createParallellCommandsExecutor (tasks, workingDir, envVars, watchMode, host) {
    return new Observable(observer => {  
        const exitCodes = tasks.map(()=>undefined);
        let completeCount = 0;

        tasks.forEach((commands, i) => {
            const observable = createSequencialCommandExecutor(
                commands, workingDir, envVars, watchMode, host);
            
            observable.subscribe({
                next ({command, exitCode}) {
                    exitCodes[i] = exitCode || 0;
                    if (!!exitCode) {
                        // Partial failure. Emit the error directly to output to console
                        // which command that failed. May be repaired by a watcher watching changed
                        // source.
                        observer.next({command, exitCode});
                        return;
                    }
                    if (exitCodes.every(code => code === 0)) {
                        observer.next({exitCode: 0});
                    }
                },
                error(err) {
                    observer.error(err);
                },
                complete() {
                    if (++completeCount === tasks.length) {
                        observer.complete();
                    }
                }
            });
        });
    });
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
    return new Observable (observer => {
        var prevComplete = false;
        var childProcess = null;
        var childSubscription = null; // Treat childSubscription exactly the same way as childProcess.

        var prevSubscription = prevObservable.subscribe({
            next (envProps) {
                let [cmd, ...args] = tokenize (command, envProps.env);
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
                if (childProcess) {
                    // We've created a process as a response to a previous next().
                    // We are expected to re-execute the command.
                    try {
                        //console.log(`Killing ${command}`);
                        childProcess.kill('SIGTERM'); // Or should we use SIGINT ('CTRL-C')
                    } catch(err) {
                        console.error(`Failed to kill '${command}'. Error: ${err}`);
                    }
                    childProcess = null;
                }
                if (childSubscription) {
                    // We've created a child subscription
                    // We are expected to re-execute the subscription.
                    childSubscription.unsubscribe();
                    childSubscription = null;
                }
                try { // Don't know if we're required to do try..catch here or if the framework does that for us. Read/test es-observable contract!
                    if (!cmd) {
                        // Comment or empty line. ignore.
                        const text = command.split('#').map(s=>s.trim());
                        if (text.length > 1) {
                            host.log(
                                COMMENT_COLOR +
                                text.slice(1).join(' ') +
                                clr.RESET);
                        }
                        observer.next(clone(envProps, {
                            command: command,
                            exitCode: 0
                        }));
                    } else if (cmd === 'cd') {
                        // cd
                        const newDir = path.resolve(envProps.cwd, args[0]);
                        host.log(`${SPECIAL_PROMPT_COLOR}> ${COMMAND_COLOR}cd ${args[0]}${clr.RESET}`);
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
                        host.log(`${SPECIAL_PROMPT_COLOR}> ${COMMAND_COLOR}${variable}=${surroundWithQuotes(value)}${clr.RESET}`);
                        observer.next(clone(envProps, {
                            command: command,
                            exitCode: 0,
                            env: newEnv
                        }));
                    } else if (cmd === 'just-build') {
                        // Shortcutting "just-build" commands to:
                        // 1. Not spawn a new process for it.
                        // 2. Not having to use [--watch] for it.
                        let {refinedArgs, grepString, useWatch} = refineArguments(args, true, command);
                        if (useWatch) {
                            host.log(`${SPECIAL_PROMPT_COLOR}> ${COMMAND_COLOR}${command}${clr.RESET}`);
                            throw new Error(`[--watch] is redundant for 'just-build'. It will invoke it automatically. http://tinyurl.com/z6ylnb7`);
                        }
                        
                        const subCfg = extractConfig (["node", "just-build"].concat(args), {
                            cwd: envProps.cwd,
                            env: envProps.env
                        });

                        extend (subCfg, {
                            log: host.log,
                            spawn: host.spawn,
                            watchMode}); // Override watchmode given to root just-build as we ignore [--watch] argument here.

                        // Treat childSubscription exactly the same way as childProcess.
                        // it is conceptually the same thing. Use unsubscribe() istead of kill().
                        childSubscription = createObservable(subCfg).subscribe ({
                            next (result) {
                                observer.next(clone(envProps, {
                                    command: result.command || command, // If succesful exitCode, result.command will be undefined.
                                    exitCode: result.exitCode
                                }));
                            },
                            complete () {
                                childSubscription = null;
                                if (prevComplete) observer.complete();
                            },
                            error (err) {
                                childSubscription = null;
                                observer.error(err);
                            }
                        });
                    } else {
                        // Ordinary command
                        let {refinedArgs, grepString, useWatch} = refineArguments(args, watchMode, command);

                        childProcess = (host.spawn)(
                            cmd,
                            refinedArgs, {
                                cwd: envProps.cwd,
                                env: envProps.env,
                                shell: true
                            });
                        
                        childProcess.stdout.pipe(new ColorTransform()).pipe(process.stdout);
                        childProcess.stderr.pipe(new ColorTransform(true)).pipe(process.stderr);

                        childProcess.on('error', err => observer.error(err)); // Correct? Or just 
                        if (useWatch) {
                            childProcess.stdout.on('data', data => {
                                if (data.indexOf(grepString) !== -1) {
                                    observer.next(clone(envProps, {
                                        command: command,
                                        exitCode: undefined // No real exit code yet. Handled as exitCode 0.
                                    }));
                                }
                            });
                        }
                        childProcess.on('exit', code => {
                            childProcess = null;
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
                if (!childProcess && !childSubscription) observer.complete();
            }
        })

        return {
            unsubscribe () {
                if (childProcess) {
                    try {
                        //console.log(`Killing ${command}`);
                        childProcess.kill('SIGTERM'); // Or should we use 'SIGINT' (CTRL-C) ?
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
                    childProcess = null;
                }
                if (childSubscription) {
                    childSubscription.unsubscribe();
                    childSubscription = null;
                }
                prevSubscription.unsubscribe();
            },
            get closed() {
                return !childProcess && !childSubscription && prevSubscription.closed;
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

module.exports = {executeAll, createObservable, refineArguments};
