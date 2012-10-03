# cfx-js #

Before all, cfx.js is just regular SDK addon.
cfx-js is meant to replace python command line application. But for now, this
addon is quite limited. In its current shape, this isn't a standalone
application yet. In this first iteration, it's just an helper for existing
python application to execute some limited tasks, like building the xpi, in JS
instead of python. This pattern allows to implement each existing feature one
by one in JS, instead of rewriting the whole set of feature at once.

## How to use it? ##

In its current state, it is just an helper for python program.
Here is how you can call some JS code from python:
`cfx.execute(command, options)` allows to execute a given `command` with
`options` dictionnary.
```python
  import cfxjs
  cfxjs.execute('build-xpi', {
    'xpi-path': '...',
    ...
  })
```

This python code will end up loading [/cfx/cfx.js](https://github.com/ochameau/addon-sdk/blob/cfx.js/cfx/cfx.js#L28-54)
module and fetch its `COMMANDS` object with the given command in order to call
the related function with the given options as first argument:
```javascript
  const COMMANDS = {
    "build-xpi": function (options) {
      require("xpi-builder").buildXPI(options['xpi-path']);
    },
    ...
  };
```

## How to contribute to cfx.js? ##

cfx.js addon modules defined in [/cfx/](https://github.com/ochameau/addon-sdk/blob/cfx.js/cfx/)
folder aren't directly used by the cfx python application. Instead, it uses the
xpi shipped here: [/cfx/xulrunner-app/cfx.xpi](https://github.com/ochameau/addon-sdk/blob/cfx.js/cfx/xulrunner-app/cfx.xpi)
So that if you want to test or commit a change to cfx.js, you have to build a
new version of this xpi file.

It is suggested to checkout two addon-sdk environnements:
  - one to build cfx.js xpi;
```sh
  $ cd /addon-sdk-build
  $ source bin/activate
  $ cd /cfx
  $ cfx xpi && cp -f cfx-js.xpi /addon-sdk-test/cfx/xpi/cfx-js.xpi
```
  - another one to test the xpi
```sh
  $ cd /addon-sdk-test
  $ source bin/activate
  $ cfx testall -v
```

## Internal workflow ##

1. `cfx.execute` method executes a xulrunner application defined in
`/cfx/xulrunner-app/` folder. We can use any mozilla runtime to execute this
xulrunner app, thanks to `-app` argument, which allow to give a path to an
`application.ini` file.

2. The xulrunner appplication registers a nsICommandLineHandler xpcom component
which allows to run some code on application startup. In next iterations, it
will easily allow to build a standalone command line application. This component
defined in
[/cfx/xulrunner-app/command-line-handler.js](https://github.com/ochameau/addon-sdk/blob/cfx.js/cfx/xulrunner-app/command-line-handler.js)
just run cfx.js xpi as if it was installed in the xulrunner application.
The cfx.js xpi has to be shipped in the addon-sdk here:
[/cfx/xulrunner-app/cfx.xpi](https://github.com/ochameau/addon-sdk/blob/cfx.js/cfx/xulrunner-app/cfx.xpi)

3. Then main module,
[/cfx/cfx.js](https://github.com/ochameau/addon-sdk/blob/cfx.js/cfx/cfx.js),
is loaded.

## How data are sent from python to JS? ##

We need to eventually pass a bunch of data from python to the JS application.
As stdin support in xulrunner app is limited or non-existent and as
environnement variable size is limited; In python, we set a single environnement
variable `CFX_OPTIONS_FILE` with an absolute path to a JSON file which contains
`command` and `options` arguments given to `cfxjs.execute` method. This variable
is later read by [/cfx/cfx.js](https://github.com/ochameau/addon-sdk/blob/cfx.js/cfx/cfx.js)
and the JSON file is parsed in order to execute the given command.

## Supported commands ##

### install-xpi ###

Install a given xpi into the currently running firefox/xulrunner application

Required `options` object:
```js
{
  "path": string // Absolute path to the xpi to install
}
```

### build-xpi ###

Build an addon SDK addon.

Required `options` object:
```js
{
  // Absolute path to the xpi we want to build
  "xpi-path": "/my-addon/addon.xpi"

  // Absolute path to the temaplate folder.
  // All files from this folder are going to be written in the xpi.
  "template-path": "/addon-sdk/python-lib/cuddlefish/app-extension/"

  // Content of the `install.rdf` to write in the xpi
  "install-rdf": "<?xml version=\"1.0\" encoding=\"utf-8\"?><Description ..."

  // Absolute path the the default icon for this addon
  "icon": "/my-addon/icon.png"

  // Same thing, but for a 64px version of it
  "icon64": "/my-addon/icon64.png"

  // A dictionnary of packages. Keys are packages names, values are another
  // dictionnary with packages section folders. These folders are written
  // into `resources` directory in the xpi
  "packages": {
    "api-utils": { // package name
      "test": "/my-addon/tests/", // section name => absolute path to it
      "lib": "/my-addon/"
    }
  }

  // A dictionnary of available locales for this addon. Keys are language
  // code and values are another dictionnary with all translated strings
  "locale": {
    "en-US": { // language code
      "key": "translation" // key to translate => translated key
    }
  },

  // Optional list of white-listed files to accept into the xpi
  // Used to select which module will be copied
  "limitTo": [
    "/addon-sdk/addon-kit/lib/page-mod.js",
    "/my-addon/main.js",
    "..."
  ],

  // Object containing set of various data necessary to build the xpi and
  // it's harness-options.json manifest file
  "harness-options": {
    // Addon id, "some-unique-string@jetpack", or, UUID
    // like "{79daaae6-5916-49ba-8d3c-f54df65f210b}"
    "jetpackID": "some-unique-string@jetpack"

    // Optional dictionnary of preferences fields supported by this addon
    "preferences": {
      {
        // Preference type, either: "string", "bool" or "integer"
        "type": "bool"

        // Preference internal name
        "name": "my-bool-pref",

        // Preference default value, either a boolean, a string or a non-float
        // number:
        "value": true,

        // Preference title display in about:addons options panel
        "title": "My boolean preference"
      },

    }

    // All these `harness-options` attributes are used to build the xpi
    // but you can pass other attributes. They will be written into
    // `harness-options.json` at xpi's root folder. Like `metadata` attribute.
    ...
  },

  // A set of additional user attributes to write into `harness-options.json`
  // Used by Addon builder team while building xpi
  "extra-harness-options": {
    "builderVersion": "1.8" // Any key except ones documented previously,
                            // any value to add into the manifest file
  }
}
```
