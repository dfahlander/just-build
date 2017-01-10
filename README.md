# just-build
Simplistic task runner with specific support for --watch.

# Why

npm scripts in package.json are great but they do not support --watch. I personally needed custom
build steps, that would have easily solved with npm scripts (or a bash script) if it wasn't for the
lack of --watch support. Incremential builds are so essential for the development of any library.
Contributors must be able to `npm link` and `npm run watch` with ease if it should be possible to
maintain a library. So I was using custom javascripts-based build scripts for a while, until I found
them start becoming a hard-to-maintain part of my lib. That's when I decided that I do not want
complex build systems at all.

What about Grunt and Gulp then? To be honest, I was drowning in issues while googling about using
rollupjs with Gulp. And I feel a little scared that Gulp or Grunt would put me into situations
where a certain version of tsc, rollup, babel or whatever, hasn't got a corresponding up-to-date
gulp-plugin.

# Usage (simple)

```
npm install just-build --save-dev
```

### *package.json*

You configure your build tasks within package.json itself under "just-build" attribute.

```
{
    "just-build": {
        "default": [
            "<CLI command 1> [--watch [grep-text]]",
            "<CLI command 2>",
            ...
        ]
        "task-name-1": [
            "<CLI command 1> [--watch [grep-text]]",
            "<CLI command 2>",
            ...
        ],
        "task-name-2": [
            "<CLI command 1> [--watch [grep-text]]",
            "<CLI command 2>",
            ...
        ],
    }
}
```
The "default" task will be executed when no arguments was given to `just-build`.

# CLI

```
just-build [<options>] [<task>]
```

## options

```
    -w --watch   Any command including "[--watch '.*']" will be executed with the --watch
                 flag and the process will start listening for whenever stdout will output 
                 the given substring. Whenever it does, it will emit the rest of the flow.

    -p --package Path to an npm package root (or a json file containing "just-build" 
                 attribute). If a directory is given, it's package.json will be read 
                 instead of the current package's package.json. If a .json file is
                 given, that file will be parsed for "just-build" attribute just like
                 package.json is read.
```

# Sample

*package.json*

```json
{
    "name": "my-library",
    "version": "1.0",
    "main": "dist/index.js",
    "scripts": {
        "build": "just-build",
        "watch": "just-build --watch",
        "test": "mocha test/"
    },
    "just-build": {
        "default": [
            "just-build myApp [--watch 'just-build myApp done']",
            "just-build test [--watch 'just-build test done']"
        ],
        "myApp": [
            "tsc [--watch 'Compilation complete.']",
            "rollup -c",
            "uglifyjs dist/index.js -m -c -o dist/index.min.js --source-map dist/index.min.js.map  --in-source-map dist/index.js.map",
            "bash tools/replace-version.sh dist/index.js",
            "node tools/replace-date.js dist/index.min.js"
        ],
        "test": [
            "tsc --project test [--watch 'Compilation complete.']",
            "echo \"Foo Bar\""
        ]
    }
}
```

Then to build the default flow, type:

```
npm run build
```

The above command will build the default task, which in its turn will build both myApp and test.
This will result in the following sequence:

1. tsc
2. rollup -c
3. *...the rest of commands in "myApp"*
4. tsc --project test
5. echo "Foo Bar"

To run in watch mode:

```
npm run watch
```
*or:*
```
npm run build -- --watch
```
*Notice the stand-alone "--"! It tells npm run to pass remaining args to script.*

Any of the above commands will build the two targets with the ability to watch them both!

This is the detailed sequence that will be executed:

1. tsc --watch
2. Whenever stdout from tsc --watch emits "Compilation complete.", execute the following flow:
    1. rollup -c
    2. uglifyjs...
    3. bash... and node ...
    4. *At this point, everything in the "myApp" target is built*. It will now output **just-build myApp done.**
       to stdout. Then it will continue by invoking the next target 'test':
    5. tsc --project test --watch
    6. Whenever stdout from tsc --project test --watch emits "Compilation complete.", execute following:
        1. echo "Foo Bar"
        2. *At this point, everything in the "test" target is build*. It will now output
           **just-build test done.** to stdout.


To just build the app:

```
npm run build -- myApp
```
*Do not forget the empty "--" in the middle!*


To build the app and start watching:

```
npm run build -- myApp --watch
```

# PATH env variable

When run via "npm run ...", PATH variable will always include locally installed node modules. But also
if invoked outside of "npm run ...", it will mimic the npm run behavior and add *&lt;current working dir&gt; +
"node_modules/.bin/"* to PATH so that your commands always picks locally installed scripts.

# Working Directory
The working directory will always be the package root at the beginning of each target no matter where
the user stand when executing the script, or whether a task in a previously run script has changed
directory.

# Supported Shell
This script is very simple and will only use [child_process.exec()](https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback)
to execute each CLI command in your build targets. This is almost always true (see *Special Treatment of Certain Command Strings* below). What this means is that
it will execute cmd on windows and bash or sh on *nix, so you should not invoke env-variables or rely on bash-specific
features in your commands. If that is required, launch `bash <your-script.sh>` on a line and do the advanced bash-
things in your-script.sh instead. Windows-users using git-bash have bash.exe in their path, so it can work on
windows too.

# Special Treatment of Certain Command Strings
Each command listed is passed to [child_process.exec()](https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback)
except the following specialities:

* "cd"  - If a line begins with "cd" the script will invoke process.chdir on the rest. Invoking [child_process.exec()](https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback)
would have no effect.
* "[--watch <grep-string>]" - If a line has a substring "[--watch .*]", it will be omitted unless --watch was given to the just-build itself.
If so, it will only use "--watch" part (not "[", "]" or the grep-string). Then, it will start listening for *grep-string* and when a line
contains it, it will launch a new child-process that continues the rest of the flow while still keeping the orig process alive
listening for more *grep-string* occurrancies.

# Recursive use
As the sample shows, you can have a main task calling sub tasks by invoking `just-build task_name [--watch 'just-build task_name done']`.
It is treated as any other command, namely calling just-build task if no watch flag was used, and just-build task --watch if watch
flag was used. It watches for a line 'just-build task_name done' which is safe to listen for to detect when the full flow has been built.

# Automatic Cancellation of tasks
If you have several commands containing [--watch ...], or if you are building the watch mode will execute parallell
processes for watching (as you can read out from the flow explanation of the sample).

The script will kill any started process and cancel the task if something of the following happens:

1. The user cancels the just-build script itself.
2. A command with [--watch ...] in it is triggered while still executing the continous flow.

The first bullet is just due to that we execute child processes, and the system will make sure they are killed when
main process is.

The second bullet makes sure that it is time to re-run the trailing flow because one source file has changed. Would
be waste of resources and also volatile to continue rollup while the files being rolled up are changing.

So if we take the sample where typescript (tsc) is executed with --watch at the first command, followed by
rollup, uglifyjs and some custom scripts, let's say it is in the middle of rollup while user saves a new version of a
source file. Then rollup will get killed immediately and restarted from scratch.

