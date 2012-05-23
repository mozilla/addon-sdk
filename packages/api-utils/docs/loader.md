<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

Module exposes low level API for creating [CommonJS module][CommonJS Modules]
loaders. Code is intentionally authored such that it can be consumed in a several ways:

1. It can be loaded as regular script tag in a documents that have [system principals][]:

        <script type='application/javascript' src='resource://gre/modules/loader.js'></script>

2. It can be loaded as [JSM style module][]:

        let { Loader, Require, unload } = Components.utils.import('resource://gre/modules/loader.js');

3. It can be required as commonjs module from module loaded in loader itself:

        let { Loader, Require, unload } = require('toolkit/loader');

## What is it good for ?

- Loaders can be used to create somewhat standardized JS environments that
  people doing non-browser JS are familiar with.
- Loader provides environment for loading
  [CommonJS style modules][CommonJS modules], which makes possible to consume
  [lots of interesting code](http://search.npmjs.org/) that was already developed.
- Loader secures each module into isolated JS sandbox and makes any capability
  imports explicit via calls to provided `require` function.
- Task specific loaders with restricted module access can be created.
- Loaders provides unload hooks that may be used to undo changes made by
  anything loaded into it.

## Instantiation

Loader module provides `Loader` function that may be used to instantiate new
loader instances:

    let loader = Loader(options);

## Configuration

Desired loader behavior may vary depending on use case, there for `Loader`
may be provided with a set of options to configure it appropriately:

### paths

Loader needs to be provided with a set of locations to indicate where required
modules should be loaded from. Loader takes required `options.paths` hash, that
represents mapping of module id prefixes to a locations. There are lots of
different possibilities, but most common setup look like one below:

    let { Loader } = require('toolkit/loader');
    let loader = Loader({
      paths: {
        // Resolve all modules starting with `toolkit/` as follows:
        // toolkit/foo      ->  resource://gre/modules/toolkit/foo.js
        // toolkit/foo/bar  ->  resource://gre/modules/foo/bar.js
        'toolkit/': 'resource://gre/modules/',
        // Resolev all other non-relative module requirements as follows:
        // devtools/gcli    ->  resource:///modules/devtools/gcli.js
        // panel            ->  resource:///modules/panel.js
        '': 'resource:///modules/',
      }
    })

Note that all relative URLs requirements (ones that start with `.` character)
are first resolved relative to requirer module `id` and result of it is then
resolved using given `paths` configuration. Although you still may end up with
a relative module id (if entry point module id is relative itself). In those
cases you have to decide want entry point module is relative to and provide
appropriate `./` mapping in `paths`:

    let { Loader } = require('toolkit/loader');
    let loader = Loader({
      paths: {
        // Resolve all modules starting with `toolkit/` as follows:
        // toolkit/foo      ->  resource://gre/modules/toolkit/foo.js
        // toolkit/foo/bar  ->  resource://gre/modules/foo/bar.js
        'toolkit/': 'resource://gre/modules/',
        // Resolev all other non-relative module requirements as follows:
        // devtools/gcli    ->  resource:///modules/devtools/gcli.js
        // panel            ->  resource:///modules/panel.js
        '': 'resource:///modules/',
        // Allow relative URLs and resolve them to add-on root:
        // ./main           ->  resource://my-addon/root/main.js
        './': 'resource://my-addon/root/'
      }
    });

Keep in mind that order of keys in `paths` is irrelevant, since they are sorted
by keys from longest to shortest to allow overlaying mapping. BTW example above
in fact overlays base path `''` with different mapping for `'toolkit/'` prefixed
modules.

### Modules

Loader may **optionally** be provided with a set of module exports. In SDK
we call them **pseudo modules** and typically prefix with `@` character. This
feature may be used in few different ways:

1. To expose API that don't have a JS file with an implementation, or simply
   are authored in non compatible format (like JSM style module for example):

        let { Loader } = require('toolkit/loader');
        let loader = Loader({
          modules: {
            // require('net/utils') will get NetUtil.jsm
            'net/utils': Cu.import('resource:///modules/NetUtil.jsm')
          }
        });

   In fact each loader instance comes with set of built-in pseudo modules,
   that are described in further details under "Built-in modules" section.

2. This feature also may be employed to reuse already loaded module instances.
   For example in SDK loader is loaded at bootstrap as a JSM module, but then
   it is exposed as pseudo-module to avoid overhead of subsequent loads:

        let loaderModule = Cu.import('resources://gre/modules/loader.js');
        let loader = loaderModule.Loader({
          modules: {
            // Overlay `toolkit/loader` so that `require('toolkit/loader')`
            // will return our `loaderModule`.
            'toolkit/loader': loaderModule
          }
        });

   Use this feature with a great care though, while reusage may sound like
   compellin idea, it comes with side effect of shared state, which is not
   that great for many reason. For example unload of a loader won't trigger
   unload hooks on pseudo-modules.

### Globals

Each module loaded via loader instance is secured into own JS sandbox. These
modules don't share scope and gets own set of built-ins
(`Object, Array, String ..`). Although sometimes it's convenient to
define a set of common globals that will be shared across them. This can be
done via optional `globals` option passed to a `Loader`. For example SDK uses
this feature to provide global `console` object:

    let { Loader } = require('toolkit/loader');
    let loader = Loader({
      globals: {
        console: console: {
          log: dump.bind(dump, 'log: '),
          info: dump.bind(dump, 'info: '),
          warn: dump.bind(dump, 'warn: '),
          error: dump.bind(dump, 'error: ')
        }
      }
    });

Be careful to not misuse this feature! In general it is not recommend
to provide features via globals, it's almost always better to use
pseudo-modules or even better modules instead.

### Customize resolution

Loader can be configured even further by providing optional `resolve` option.
This allows to define completely customized module resolution logic. Option
`resolve` is expected to be a function that takes module `id` that `require`
was called with and an `id` of the requirer module, from which `require` was
called. If this option is not provided loader will use plain path resolution.
This feature may also be used to imply specific security constraints. For
example SDK at build-time generates a manifest file representing a dependency
graph of all modules used by an add-on. Any attempt to load module violating
manifest is unauthorized and is rejected with an exception:

    let { Loader } = require('toolkit/loader');
    let manifest = {
      './main': {
        'requirements': {
          'panel': 'sdk/panel'
        }
      },
      'sdk/panel': {
        'requirements': {
          'chrome': 'chrome'
        }
      }
      'chrome': {
        'requirements': {}
      }
    };
    let loader = Loader({
      resolve: function(id, requirer) {
        let requirements = manifest[requirer];
        if (id in manifest)
          return requirements[id];
        else
          throw Error('Module "' + requirer + '" has no athority to require ' +
                      'module "' + id + "')
      }
    });

Note that thrown exceptions will propagate to caller of `require`. If `resolve`
does not returns string value exception will be thrown as loader failed to
resolve required module URI. Please note that returned value is still an `id`
which later is resolved to URL using mapping provided via `paths` option.

### All together

Now all of this options can be combined to configure loader to adjust to
a specific use case. Don't get too excited about configuration options, keep
in mind that modules are more useful if they interoperability can be used across
loader instances. Unless you have any specific needs it's best to stick to a
following SDK compatible configuration:

    let { Loader } = require('toolkit/loader');
    let loader = Loader({
      paths: {
        // Resolve all non-relative module requirements to
        // `resource:///modules/` base URI.
        '': 'resource:///modules/',

        // Reserve `toolkit/` prefix for generic, mozilla toolkit modules
        // and resolve them to `resource://gre/modules/` URI.
        'toolkit/': 'resource://gre/modules/'
      },
      globals: {
        // Provide developers with well known `console` object, hopefully
        // with a more advanced implementation.
        console: {
          log: dump.bind(dump, 'log: '),
          info: dump.bind(dump, 'info: '),
          warn: dump.bind(dump, 'warn: '),
          error: dump.bind(dump, 'error: ')
        }
      },
      modules: {
        // Expose legacy API via pseudo modules that eventually may be
        // replaced with a real ones :)
        'devtools/gcli': Cu.import('resource:///modules/gcli.jsm'),
        'net/utils': Cu.import('resource:///modules/NetUtil.jsm')
      }
    });

### Loader instances

Loader produces instances that are nothing more than representation of
environment state into which modules are loaded. It is intentionally made
immutable and all it's properties are just an implementation details that
no one should depend upon, they may change at any point without any further
notice.

## Loading modules

CommonJS specification defines notion of **main** module, which represents
an entry point to a program. Loader module exposes function `main` that can
be used for loading a main module, that starts an execution, all other modules
will be loaded either by it or it's dependencies:

    let { main, Loader } = require('toolkit/loader');
    let loader = Loader(options);
    let program = main(loader, './main');

Module can recognize if it was loaded as main in order to act accordingly:

    if (require.main === module)
      main();

It is possible to load other modules before a main one, but it's inherently
harder to do. That's because every module, other then main has a requirer,
based on which resolution and authority decisions are made. In order to load
module before a main one (for example to bootstrap an environment) requirer
must be created first:

    let { Require, Loader, Module } = require('toolkit/loader');
    let loader = Loader(options);
    let requirer = Module(requirerID, requirerURI);
    let require = Require(loader, requirer);
    let boostrap = require(bootstrapID);

# Built-in modules

Each loader exposes set of built-in pseudo modules:

- `chrome` This module exposes everything that is typically available for JS
  contexts with [system principals] under [Components] global. This alternative
  approach of providing same capabilities via modules allows building module
  capability graphs (by analyzing require statements) that can be used to reason
  about modules without diving into implementation details.

- `@loader/options` module exposes all of the `options` that had being
  passed to the enclosing `Loader` during incitation. This allows creation
  of new loader instances identical to an enclosing one:

        let { Loader } = require('toolkit/loader');
        let options = require('@loader/options');
        let loader = Loader(options);

  This module is useful in very specific cases. For example SDK uses this
  feature during test execution to create identical environment with a
  different state to test how specific modules handle unloads.

- `@loader/unload` This module exposes an object that is unique per loader
  instance. It is used as a subject for [observer notification][] to allow
  use of [observer service][] for defining hooks reacting on unload of
  a specific loader. SDK builds higher level API on top for handling unloads
  and doing cleanups:

        let unloadSubject = require('@loader/unload');
        let observer = {
          observe: function onunload({ subject, data: reason }) {
          // If this loader is unload then `subject.wrappedJSObject` will be
          // `destructor`.
          if (subject.wrappedJSObject === unloadSubject)
              cleanup(reason)
          }
        };
        
# Unload

Module exposes function `unload` that can be used to unload specific loader
instance and undo changes made by modules loaded into it. `unload` takes
`loader` as a first argument and optionally a `reason` string identifying
reason why given loader was unloaded. For example in SDK reason may be:
`shutdown`, `disable`, `uninstiall`. Call to this function will dispatch
[observer notification][] that modules are expected to listen for to perform
cleunps. Notification subject will have `wrappedJSObject` property with
a value exposed as `@loader/unload` pseudo module (which can be used to
understand if enclosed loader is being unloaded). Notification `data` will
be a `reason` that observers may use to act accordingly.


# Other utilities exposed

Loader module exposes bunch of other utility functions that are used internally
and can also be handy while bootstrapping loader itself. They are low level
helpers and are recommended to be used only during loader bootstrap.

### Module

`Module` function takes module `id` and `uri` and creates a module instance
object, that are exposed as `module` variable in the module scope.

    let module  = Module('foo/bar', 'resource:///modules/foo/bar.js');

### load

`load` function takes `loader` and loads given `module` into it:

    let loader = Loader(options);
    let module  = Module('foo/bar', 'resource:///modules/foo/bar.js');
    load(loader, module);

## Sandbox

`Sandbox` function is an utility function for creating [JS sandboxes][] and is
used by loader to create scopes into which modules are loaded. Function takes
set of configuration options:

- `name`: A string value which identifies the sandbox in about:memory.
  Will throw exception if omitted.
- `principal`: String URI or `nsIPrincipal` for the sandbox.
  If omitted will defaults to system principal.
- `prototype`: Object that returned sandbox will inherit from.
   Defaults to `{}`.
- `wantXrays`: A Boolean value indicating whether code outside the sandbox
   wants X-ray vision with respect to objects inside the sandbox. Defaults
   to `true`.
- `sandbox`: A sandbox to share JS compartment with. If omitted new compartment
   will be created.
   
       let sandbox = Sandbox({
         name: 'resource:///modules/foo/bar.js',
         wantXrays: false,
         prototype: {
           console: {
             log: dump.bind(dump, 'log: '),
             info: dump.bind(dump, 'info: '),
             warn: dump.bind(dump, 'warn: '),
             error: dump.bind(dump, 'error: ')
           }
         }
       });

## evaluate

Evaluates code into given `sandbox`. If `options.source` is provided than it's
value is evaluated otherwise source is read from a given `uri`. Either way any
exceptions will be reported as from given `uri`. Optionally more options may be
specified:

- `options.encoding` Defining source encoding, defaults to 'UTF-8'.
- `options.line` Defining a line number to start count from in stack traces.
  Defaults to 1.
- `options.version` Defining a version of JS used, defaults to '1.8'.

## Require

As already mentioned under the section "Loading modules" it's common to start
execution chain by loading a main module. But sometimes you may want to prepare
environment using existing modules before doing that. In such cases you can
create requirer module instance and a version of `require` exposed to it with
this function:

    let requirer = Module(requirerID, requirerURI);
    let require = Require(loader, requirer);
    let boostrap = require(bootstrapID);

## resolveURI

This function is used by loader to resolve module `uri` from an `id` using
mapping array generated from loaders `paths` option. Function iterates each
element until it finds matching prefix that `id` start with and replaces it
with a location it maps to:

    let mapping = [
      [ 'toolkit/', 'resource://gre/modules/' ],
      [ './',       'resource://my-addon/'    ], 
      [ '',         'resource:///modules/'    ]
    ];
    resolveURI('./main', mapping);           // => resource://my-addon/main.js
    resolveURI('devtools/gcli', mapping);    // => resource:///resources/devtools/gcli.js
    resolveURI('toolkit/promise', mapping);  // => resource://gre/resources/promise.js    

## override

This function is used to create a fresh object that contains own properties of
two arguments it takes. If arguments have properties with a conflicting names
the right one gets to override property. This function is helpful for
combining default and passed properties:

    override({ a: 1, b: 1 }, { b: 2, c: 2 }) // => { a: 1, b: 2, c: 2 }

## descriptor

This utility function takes an object and as an argument and returns property
descriptor map for it's own properties. Useful when working with object
functions introduced in ES5 (`Object.create, Object.defineProperties, ..`):

    // define properties of `source` on `target`.
    Object.defineProperties(target, descriptor(source))

[CommonJS Modules]:http://wiki.commonjs.org/wiki/Modules/1.1.1
[system principals]:https://developer.mozilla.org/en/Security_check_basics#Principals
[JSM style module]:https://developer.mozilla.org/en/JavaScript_code_modules/Using
[Observer notification]:https://developer.mozilla.org/en/Observer_Notifications
[observer service]:https://developer.mozilla.org/en/nsiobserverservice
[Components]:https://developer.mozilla.org/en/Components
[JS Sandboxes]:https://developer.mozilla.org/en/Components.utils.Sandbox
