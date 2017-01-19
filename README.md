# just-build

[About](https://github.com/dfahlander/just-build/wiki/About)

[Command Line Interface](https://github.com/dfahlander/just-build/wiki/CLI)

[Configuration](https://github.com/dfahlander/just-build/wiki/Configuration)

[Technical Details](https://github.com/dfahlander/just-build/wiki/Technical-Details)

[Error Reference](https://github.com/dfahlander/just-build/wiki/Error-Reference)

# Quick Reference

## install

```
npm install just-build --save-dev
```
*Using `--save-dev` because you typically configure `npm run build` to call upon it, which works perfectly well will locally installed binaries.*

## package.json

```js
{
  "scripts": {
    "build": "just-build",
    "watch": "just-build --watch"
  },
  "just-build": {
    "default": [
       "just-build src test" // builds src and test (in parallell)
    ],
    "src": [
      "cd src",
      "tsc [--watch 'Compilation complete.']",
      "rollup -c", // executed on each code change
      "eslint src" // executed after rollup (if rollup succeeds)
    ],
    "test": [
      "cd test",
      "tsc [--watch 'Compilation complete.']",
      "rollup -c"
    ],
    "production": [
      "NODE_ENV='production'",
      "just-build"
    ]
  }
}
```

## Build

```
node_modules/.bin/just-build
```

or:

```
npm run build
```

## watch

```
node_modules/.bin/just-build --watch
```

or:

```
npm run watch
```

## Build Specific Task

```
node_modules/.bin/just-build production
```

or:

```
npm run build production
```

## Watch Specific Task

```
node_modules/.bin/just-build production --watch
```

or:

```
npm run watch production
```

## Parallell Build

```
node_modules/.bin/just-build src test
```

or:

```
npm run build src test
```

## Parallell Watch

```
node_modules/.bin/just-build src test --watch
```

or:

```
npm run watch src test
```

# Limitations

This tool executes each configured command string using [child_process.spawn()](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options) with `shell:true`. You can't do all things you could do in bash. For example:

* <strike>echo "hello world" > out.txt</strike>
* <strike>echo "hello world" | grep "hello" </strike>
* <strike>echo '$(node -p 1)'</strike>

# Special Commands
*(not launched by [child_process.spawn()](https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options))*

<table>
<tr>
  <th>just-build</th>
  <td>Will shortcut to call recursively on other scripts without the cost of spawning another just-build process. The `[--watch]` argument is automatically appended and you do not need to add it. You get an error if you do.</td>
</tr><tr>
  <th>&lt;locally installed binary&gt;</th>
  <td>If you've installed a binary locally <code>npm install typescript --save-dev</code>, and you invoke <code>tsc</code> which is a binary bundled with typescript, an optimization kicks in so that the binary is launched using child_process.fork() instead of child_process.spawn().</td>
</tr><tr>
  <th>node</th>
  <td>If you execute a JS script using <pre>node scripts/myscript.js</pre> the script will be executed using child_process.fork() instead of child_process.spawn() to optimize resources.</td>
</tr><tr>
  <th>cd</th>
  <td>Changes working directory for the next command. Note that working directory will always be the package root initially for each task.</td>
</tr><tr>
  <th>NAME=VALUE</th>
  <td>Sets environment variable such as NODE_ENV=production</td>
</tr><tr>
  <th># comments...</th>
  <td>Every line is stripped from # comments. Can be used to document the purposes of your tasks.</td>
</tr>
</table>