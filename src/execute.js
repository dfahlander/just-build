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
        let taskWatchers = cfg.tasksToRun.map(taskName => createTaskExecutor (taskName, cfg));
        // Make commands execute sequencial by reducing the observers using Observable.concat()
        let sequencialObserver = taskWatchers.reduce((pw1, pw2) => pw1.concat(pw2));
        //let sequencialObserver = taskWatchers[0];
        // Execute them all and handle each watch wakeup.
        sequencialObserver.subscribe({
            next () {
                cfg.log(`just-build ${cfg.tasksToRun.join(',')} done.`);
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
function createTaskExecutor (taskName, cfg) {
    let commands = cfg.taskSet[taskName];

    const source = Observable.from([{
        cwd: cfg.dir,
        env: cfg.env
    }]);

    return commands.reduce((prev, command) => createCommandExecutor(command, prev, cfg), source);
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
        var childProcess = null,
            childProcessHasExited = false;

        var prevSubscription = prevObservable.subscribe({
            next (spawnOptions) {
                try { // Don't know if we're required to do try..catch here or if the framework does that for us. Read/test es-observable contract!
                    if (!cmd) {
                        // Comment or empty line. ignore.
                        observer.next(spawnOptions);
                    } else if (cmd === 'cd') {
                        // cd
                        const newDir = path.resolve(spawnOptions.cwd, args[0]);
                        const nextSpawnOptions = clone(spawnOptions, {cwd: newDir});
                        observer.next(nextSpawnOptions);
                    } else if (cmd.indexOf('=') !== -1 || args.length > 0 && args[0].indexOf('=') === 0) {
                        // ENV_VAR = value, ENV_VAR=value, ENV_VAR= value or ENV_VAR =value.
                        const statement = args.length > 0 ?
                            args[0] === '=' ?
                                cmd + args[0] + args[1] :
                                cmd + args[0] :
                            cmd;
                        const [variable, value] = statement.split('=');
                        const newEnv = clone(spawnOptions.env);
                        newEnv[variable] = value;
                        const nextSpawnOptions = clone(spawnOptions, {env: newEnv});
                        observer.next(nextSpawnOptions);
                    } else {
                        // Ordinary command
                        let {refinedArgs, grepString, useWatch} = refineArguments(args, hostCfg.watchMode, command);
                        childProcess = (hostCfg.spawn)(cmd, refinedArgs, spawnOptions);
                        childProcess.on('error', err => observer.error(err));
                        if (useWatch) {
                            childProcess.stdout.on('data', data => {
                                if (data.indexOf(grepString) !== -1) {
                                    observer.next(spawnOptions);
                                }
                            });
                        }
                        childProcess.on('exit', code => {
                            childProcessHasExited = true;
                            if (code === 0) {
                                observer.next(spawnOptions);
                                observer.complete();
                            } else
                                observer.error(new Error(`Command '${command}' returned ${code}`));
                        });                    
                    }
                    
                } catch (err) {
                    // Don't know if we're required to call setImmediate() here or if the framework does that for us. Read/test es-observable contract!
                    setImmediate(()=>observer.error(err));
                }
            },
            error(err) {
                observer.error(err);
            }
        })

        return {
            unsubscribe () {
                if (childProcess) {
                    if (!childProcessHasExited) {
                        try {
                            childProcess.kill();
                            childProcessHasExited = true;
                        }
                        catch (err) {
                            console.error(`Failed to kill '${command}'. Error: ${err.stack || err}`);
                        };
                    }
                    childProcess = null;
                }
                prevSubscription.unsubscribe();
            },
            get closed() {
                return childProcessHasExited;
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
