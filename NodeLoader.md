# Introduction to Loader Changes

The loader change would be a change to how files are resolved when using Jetpack's `require` to accomodate node modules.


## Goals

* **Use npm for dependency management**: A goal for loader changes is to be able to define [npm](https://npmjs.org/) dependencies in a Jetpack `package.json`, and loader's `require` to consume the npm dependencies.
* **Use node-like modules in Jetpack code**: Using native [node modules](http://nodejs.org/api/), like `fs` and `path` in Jetpack code.

## Requirements

* **Load native node modules**: `require('fs')` --> `require('sdk/io/fs')`
* **Reconsider node module placement**: Should these live as their own in the `sdk` tree, or should they be separate in their own dir, like `require('node/fs')`? Separating them may be more clear, but I think we would have redundancy, or it seems inadequate (like no file system API in our `sdk/io` directory). I think having `require('node/fs')` isn't a bad idea to start discussion, with mapping of `require('fs')` to the node directory if its a node module for dependency support.

* **Load node dependencies**: `require('underscore')` -- this may be an issue for when there are multiple versions throughout, but handling it via Node's lookup algorithm should be sufficient

* **Overload native node modules**: (Possibly phase 2?) The ability to define overloads for native node modules, so user's can provide their implementation from preference or because Jetpack does not yet have support. For example, the Jetpack `fs` implementation does not support some methods, yet a user could have created a module that does, or provide an implementation for `util`, which Jetpack does not currently have.

## Concerns

* **Compile time mapping?** This will require some work with the AOM revamp -- currently, all the modules are mapped during `cfx` compile, and the nature of node's lookup may require run-time resource resolving. This may be a good time, with the changes in AOM, to reconsider how loader loads files.
* **Loading a directory** Loading a directory in node will check first for a `package.json`'s `main` entry, loading that file, falling back to looking for an `index.js`. Supporting this may cause some issues with Jetpack, but a requirement to support any amount of node modules, as this is pretty common in any node module.
* **New Globals** Variables that are in the [global scope](http://nodejs.org/api/globals.html) of node (`process`, `__filename`, `__dirname`), and used often enough to need to be supported. May have an issue with things like `__dirname` when Jetpacks are packaged.
* **`module` properties** Node's `module` has additional properties that Jetpack does not currently have. `id`, `filename`, `loaded`, `parent`, `require`, `children` are just a few. I do not think these are all that common in Nodeland.
* **Binary/.node files** I can't imagine being able to support this, especially as if we require all the node modules to be bundled on Jetpack publish.
* **Global requires** I can't imagine being able to support this. (As in `npm install -g underscore` and then requiring that in any module)


## Node's Algorithm for Loading

From [Node's Module Page](http://nodejs.org/api/modules.html#modules_all_together):

```
require(X) from module at path Y
1. If X is a core module,
  a. return the core module
  b. STOP
  2. If X begins with './' or '/' or '../'
  a. LOAD_AS_FILE(Y + X)
  b. LOAD_AS_DIRECTORY(Y + X)
3. LOAD_NODE_MODULES(X, dirname(Y))
4. THROW "not found"

LOAD_AS_FILE(X)
  1. If X is a file, load X as JavaScript text.  STOP
  2. If X.js is a file, load X.js as JavaScript text.  STOP
  3. If X.node is a file, load X.node as binary addon.  STOP

LOAD_AS_DIRECTORY(X)
  1. If X/package.json is a file,
    a. Parse X/package.json, and look for "main" field.
    b. let M = X + (json main field)
    c. LOAD_AS_FILE(M)
  2. If X/index.js is a file, load X/index.js as JavaScript text.  STOP
  3. If X/index.node is a file, load X/index.node as binary addon.  STOP

LOAD_NODE_MODULES(X, START)
  1. let DIRS=NODE_MODULES_PATHS(START)
  2. for each DIR in DIRS:
    a. LOAD_AS_FILE(DIR/X)
    b. LOAD_AS_DIRECTORY(DIR/X)

NODE_MODULES_PATHS(START)
  1. let PARTS = path split(START)
  2. let ROOT = index of first instance of "node_modules" in PARTS, or 0
  3. let I = count of PARTS - 1
  4. let DIRS = []
  5. while I > ROOT,
    a. if PARTS[I] = "node_modules" CONTINUE
    b. DIR = path join(PARTS[0 .. I] + "node_modules")
    c. DIRS = DIRS + DIR
    d. let I = I - 1
  6. return DIRS
```

http://nodejs.org/api/modules.html#modules_all_together


### Project Dependencies

* Loader Changes
* Node Module movement possibly (into `./lib/node/`)
* Develop more node modules for more dependency support
* Implement node globals (`process`, `module` properties, `__dirname`, etc)
* Nail down how the AOM changes will affect add-ons, will they be packaged, how will they be structured

