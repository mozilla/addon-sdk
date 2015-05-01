# Introduction to Loader Changes

The loader change would be a change to how files are resolved when using Jetpack's `require` to accomodate node modules.


## Goals

* **Use npm for dependency management**: A goal for loader changes is to be able to define [npm](https://npmjs.org/) dependencies in a Jetpack `package.json`, and loader's `require` to consume the npm dependencies.
* **Use node-like modules in Jetpack code**: Using native [node modules](http://nodejs.org/api/), like `fs` and `path` in Jetpack code.

## Requirements

* **Load native node modules**: `require('fs')` --> `require('sdk/io/fs')`
** Requires reorganizing node modules into `./lib/node/` ([Bug 919059](https://bugzilla.mozilla.org/show_bug.cgi?id=919059)) and implementing or including as many Node modules we feel is necessary ([Bug 935108](https://bugzilla.mozilla.org/show_bug.cgi?id=935108))
** Also requires a SDK-specific alias map for top level requires to check the node directory so npm dependencies require it the same way
* **Load node dependencies**: `require('underscore')` -- this may be an issue for when there are multiple versions throughout, but handling it via Node's lookup algorithm should be sufficient. [Bug 935109](https://bugzilla.mozilla.org/show_bug.cgi?id=935109)

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

## Proposed API


### Loader(options)
  
* `manifest`: package.json file resourceURI. Needed for entry point(?) and node dependencies **new**
* `mapping`: An object representing resourceURIs for each module within a module **new**
```
  mapping: {
    'resource://../index': {
      './dir/a': 'resource://../dir/a',
      'sdk/tabs': 'sdk/tabs'
    },
    'resource://../dir/a': {
      '../utils': 'resource://../utils'
    },
    'resource://../utils': {}
  },
```

* `paths`: key-value pairing of aliases to their resourceURI 
```
  paths: {
    'modules/': 'resource://gre/modules/',
    '': 'resource://gre/modules/commonjs'
  },
```
* `modules`: An object of key-value pairs of aliases to specific objects, i.e. `'chrome': { Cc: Cc, Cu: Cu, /*...*/ }`
* `globals`: An object of globals, i.e. `globals: { 'Components': Components }`
* `resolve`: A function taking an `id` and `requirerURI` as arguments that is called when the loader's `require` is used. Currently, in Cuddlefish Loader, this is where the URI mapping occurs.

### exports.resolve(id, requirerURI)

Used for resolving URIs from their referrer. Used by default in constructing `Loader` unless overloaded. Returns a string 

```
// 'jetpack/a'
exports.resolve('../a', 'jetpack/dir/b');

// 'sdk/tabs'
exports.resolve('sdk/tabs', 'jetpack/a');
```

### exports.resolveURI(id, mapping)

Takes an `id` and resolves it to a URI via the `mapping` array. Returns a resource URI. Maps are in the form of:

```
let mapping = [
  ['./': 'resource://jetpack-uri/'],
  ['sdk/': 'resource://gre/modules/commonjs/sdk']
]

exports.resolveURI('./a', mapping) // 'resource://jetpack-uri/a.js'
exports.resolveURI('sdk/tabs', mapping) // 'resource://gre/modules/commonjs/sdk/tabs.js'
```

`resolveURI` also normalizes the URI, which involves appending `'.js'` if not already specified. **Also needs to ignore absolute resource:// URIs**

### exports.generateMap({ manifest, paths, resolve }, callback);

New static method for `Loader` module. Generates a map asynchronously that can be passed into the `Loader` constructor to eliminate runtime lookups during `require`. This map generator will also use similar internals as the runtime lookup.

* `resolve`: resolution function, similar in `Loader` constructor
* `path`: path object, similar in `Loader` constructor
* `manifest`: manifestURI, similar in `Loader` constructor, need for entry point URI and dependencies
* `callback`: Callback fired upon completion with mapping in first argument


### exports.Require(loader, requirer)

Returns a `require` function to be used in a specific context to load additional modules.

Currently works like:

* If relative, use `loader.resolve || exports.resolve` to resolve. (Only attempts to resolve if a requirer exists; cuddlefish loader depends on this as it resolves non-relative links as well unfortunately)
* Get the resource URI with the resolved id and `loader.mapping` with `resolveURI`. Takes care of normalization as well.
* **New**: Need to do runtime look up if not found in the map

## Proposed Workflow

### For Addons

#### Bootstrap Logic moves into AOM

```
// This is our SDK specific loader, replacing cuddelfish loader
let { Loader: SDKLoader } = Cu.import('resource://gre/modules/commonjs/sdk/loader/loader.js', {});
// Cached mapping object, stored in profile??
let mappings = CACHED_MAPPINGS.get(addonManifest);

// We just pass in the addon manifest and mappings if they exist into our loader
// so we can offload most of the customization and tweaking on our end
// in the future, rather than in AOM
SDKLoader(addonManifest, mappings);
```

#### Load SDK Loader (formerly CuddlefishLoader) with manifest and mappings

```
let Loader = Cu.import('resource://gre/modules/commonjs/toolkit/loader.js', {});
let { defer } = Cu.import('resource://gre/modules/Promise.jsm', {});
let PATHS = {
  '': 'resource://gre/modules/commonjs/',
  'modules/': 'resource://gre/modules/',
};
exports.SDKLoader = function (manifest, mappings, callback) {
  let { promise, resolve } = defer();
  // If no mappings exist, generate at install(?) time with Loader's static
  // `resolveAll`, returning a map
  if (!mappings) {
    Loader.resolveAll(manifest.entryURI, {
      paths: PATHS,
      manifest: manifest
    }, createLoader);
  } else { 
    createLoader(mappings);
  }

  function createLoader (map) {
    let loader = new Loader({
      mapping: map,
      modules: { ... },
      globals: { ... },
      paths: PATHS,
      manifest: manifest
    });
    resolve(loader);
  }

  return promise;
}
```

### For DevTools

## Proposed Roadmap

* Loader Changes
* Node Module movement possibly (into `./lib/node/`)
* Develop more node modules for more dependency support
* Implement node globals (`process`, `module` properties, `__dirname`, etc)
* Nail down how the AOM changes will affect add-ons, will they be packaged, how will they be structured

