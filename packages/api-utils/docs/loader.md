<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

# Loader

Module exposes low level API for creating [CommonJS module][CommonJS Modules]
loaders. Code is intentionally authored such that it can be consumed by in a
different ways:

1. Can be loaded as regular script tag in a documents that have
   [system principals][]:

        <script type='application/javascript' src='resource://gre/modules/loader.js'></script>

2. Can be loaded as JSM style module:

        let { Loader, Require, unload } = Components.utils.import('resource://gre/modules/loader.js');

3. Can be required from module loaded in the loader itself:

        let { Loader, Require, unload } = require('toolkit/loader');

## What is it good for ?

- Loaders can be used to create somewhat standardized JS environments that
  people doing non-browser outside of Mozilla are familiar with.
- Loader provides environment for loading
  [CommonJS style modules][CommonJS modules]. This makes possible to consume
  [lots of interesting code](http://search.npmjs.org/) out there.
- Loader secures each module into isolated JS sandbox and makes any capability
  import explicit via call to provided `require`.
- Task specific loaders with restricted module access can be created.
- Loaders provides unload semantics that may be used to undo changes made by
  anything within that loader instance.

## Instantiation

Loader module provides `Loader` function that may be used to instantiate new
loader instances:

    let loader = Loader(options);

## Configuration

Desired loader behavior may vary depending on use case, there for `Loader` takes
set of options, described below, to configure it appropriately:

### paths

Loader needs to be provided with a set of locations where required modules will
be loaded from. Loader takes required `options.paths` hash, that represents
mappings of module id prefixes to their locations. There are lots of different
mapping that can be created but probably most common one would look like this:

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
are resolved relative to requirer `id` and than that resulting `id` is resolved
using given `paths`. Although you still may end up with a relative module id
after resolving it to requirer (if it was relative as well), or an entry point
module may have relative `id`. In those case you have to decide want those
id's are relative to and provide additional mapping:

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

Keep in mind that order of keys is irrelevant, and later changes to `paths`
will be ignored. Loader sorts paths by keys from longest to shortest, which
allows mapping of nested sections to a different URIs, which is BTW the case
in an example above since `'toolkit/'` is overlay on subsection of base `''`.

### Modules

Loader may **optionally** be provided with a set of module exports. In SDK
we call them **pseudo modules** and typically prefix with `@` character. This
feature may be used in couple of different ways:

1. To expose API that don't necessary have a file with JS implementation. Also
   this feature may be used to expose APIs that are authored in non commonjs
   module format (JSM module for example):

        let { Loader } = require('toolkit/loader');
        let loader = Loader({
          modules: {
            // require('net/utils') will get NetUtil.jsm
            'net/utils': Cu.import('resource:///modules/NetUtil.jsm')
          }
        });

   In fact loader itself provides set of built-in pseudo modules modules
   described in further details in "Built-in modules" section.

2. This feature can also be used in order to reuse already loaded module
   instances. For example in SDK loader is loaded at bootstrap as a JSM
   module and than is exposed via modules modules hash to avoid overhead
   of subsequent loads:

        let loaderModule = Cu.import('resources://gre/modules/loader.js');
        let loader = loaderModule.Loader({
          modules: {
            // Overlay `toolkit/loader` so that `require('toolkit/loader')`
            // will return our `loaderModule`.
            'toolkit/loader': loaderModule
          }
        });

   Use this feature with a great care though, while caching may sound like
   compelling idea it has a side effect of shared state, which is not that
   great for many reason. For example unload of a loader will not trigger
   unload hooks for pseudo-modules loaded via different loader.

### Globals

Each module created / loaded by a loader instance is loaded securely into own
JS sandbox. These modules don't share same scope and each gets own set of
built-ins (`Object, Array, String ..`). Although sometimes it's convenient to
define set of globals shared across all modules which can be done via optional
`globals` option. For example SDK uses this feature to provide global `console`
object across all module scopes:

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

Be careful and do not misuse this feature! In general we do not recommend
providing features via global bindings, it's almost always better to provide
them as modules instead. If unsure use choose pseudo module or even better
regular modules!

### Customize resolution

Loader can be configured even further by providing optional `resolve` option.
These allows completely customized module resolution. Options is expected
to be a function that takes two arguments `id` passed to the `require` and
a requirer `id` which is `id` of module from which `require` was called. If
this option is not provided loader uses plain path resolution logic to resolve
against requirer. This feature may be used to define either very customized,
case specific resolution logic (**we recommend against**) or in order to imply
security constraints as we do in the SDK. For example at build time SDK
generates manifest file representing a dependency graph of all modules, any
attempt to load module violating captured dependency links unauthorized and
gets rejected with an exception:

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
does not returns string value exception will be still thrown as loader was
not able to resolve required module. Also note that returned value is just a
resolved `id` that will later resolved to URL using defined mapping provided
via required `paths` option.

### More options

You could provide even more options to a loader if you want to and loader will
make expose them via built-in pseudo module *(see "Built-in modules" section)*,
although we would still recommend to use pseudo modules instead if possible.

### All together

Now all of this options can be combined to configure loader to adjust to
a specific use case. Don't get too excited about configuration options, keep
in mind that ideally modules should stay interoperable and there for it's best
to stick to stick to a recommended configuration compatible with SDK:

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

Loader produces loader instances that are nothing more than representation of
state of environment into which modules are loaded. It's intentionally
immutable and all of it's properties are just an implementation details that
no one should depend upon as they may change without any further notice.

## Loading modules

CommonJS specification recognizes notion of **main** module. Main module is
an entry point to a program. Loader module exposes `main` function that can
can be used to load main module, which is a root of execution chain, all the
other modules are loaded either by it or it's dependencies:

    let { main, Loader } = require('toolkit/loader');
    let loader = Loader(options);
    let program = main(loader, './main');

Main module can recognize itself to be a main and perform relevant tasks:

    if (require.main === module)
      main();

While it is still possible to load other modules before loading a main one,
but it's inherently harder to do. That's because every module, but the main
one has a requirer, based on which resolution and authority decisions are made.
So in order to load some module before a main one, for example to bootstrap
an environment, one should create requirer instance first:

    let { Require, Loader, Module } = require('toolkit/loader');
    let loader = Loader(options);
    let requirer = Module(requirerID, requirerURI);
    let require = Require(loader, requirer);
    let boostrap = require(bootstrapID);


# Built-in modules

Each loader exposes set of built-in pseudo modules:

- `@loader/options` module exposes all of the `options` that had being
  passed to the enclosing `Loader` during incitation, regardless whether or not
  they are recognized by loader itself. This module is useful for creating new
  loader instances identical to an enclosing one:

        let { Loader } = require('toolkit/loader');
        let options = require('@loader/options');
        let loader = Loader(options);

  This module is useful in very specific cases. For example SDK uses this
  feature during test execution to create identical environment with a
  different state, which is extremely useful to test specific modules to
  make sure they clean up after themself on unload.

- `@loader/unload` This module exposes an object that is unique per loader
  instance and is used as an [observer notification][] subject. This allows
  use of [observer service][] to observe loader unloads and act accordingly.
  SDK provides high level API to handle unloads that uses observer to
  propagate unload across rest of the system:

        let unloadSubject = require('@loader/unload');
        let observer = {
          observe: function onunload({ subject, data: reason }) {
          // If this loader is unload then `subject.wrappedJSObject` will be
          // `destructor`.
          if (subject.wrappedJSObject === unloadSubject)
            propagate(reason)
          }
        };

- `chrome` This module exposes everything that is typically available for JS
  contexts with [system principals] under [Components] with convenient
  shortcuts. The fact that [Components] is provided as module allows building
  systems with much more granular control of capabilities, that can be reasoned
  about by analyzing requirement graphs.

[CommonJS Modules]:http://wiki.commonjs.org/wiki/Modules/1.1.1
[system principals]:https://developer.mozilla.org/en/Security_check_basics#Principals
[JSM style module]:https://developer.mozilla.org/en/JavaScript_code_modules/Using
[Observer notification]:https://developer.mozilla.org/en/Observer_Notifications
[observer service]:https://developer.mozilla.org/en/nsiobserverservice
[Components]:https://developer.mozilla.org/en/Components
