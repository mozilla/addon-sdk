# cfx-js

cfx-js is an SDK addon meant to replace python command line application.
This addon is currently quite limited but it is going to implement all features
of cfx python application in order to remove python dependency.
It currently just allow to build an XPI file.
For now, it is not meant to be used standalone, it is an helper addon used by
add-on sdk `cfx` command line application.


# How does it work

 * cfx python application set `CFX_OPTIONS_FILE` environnement variable to an
   absolute path to a JSON file that contains necessary information to execute
   some commands (use JSON file since options may not fit in environment
   variable),
 * Then, cfx python application run it through the xulrunner template,
 * Finally, the addon reads JSON from `CFX_OPTIONS_FILE` and performs tasks
   described by it.


# How to build it and install it

 * Activate your SDK environnement

        $ source bin/activate (linux/mac)
           - or -
        $ bin\activate (window)

 * Go to cfx-js directory

        $ cd cfx/

 * Generate cfx-js xpi

        $ cfx xpi

 * Then, copy it to the xulrunner application template

        $ mv cfx.xpi xulrunner-app/


# Expected JSON Object passed to cfx-js

    {
      "command": string // Name of the command to execute
      "options": object // Arguments needed to execute this command
    }

  Example:

    {
      "command": "install-xpi",
      "options": {
        "path": "/home/foo/my-addon/addon.xpi"
      }
    }

## Supported commands

### install-xpi

   Install a given xpi into the currently running firefox/xulrunner application

   Required `options` object:
   {
     "path": string // Absolute path to the xpi to install
   }

### build-xpi

  Build an addon SDK addon.

  Required `options` object:
  {
    // Absolute path to the xpi we want to build
    "xpi-path": "/my-addon/addon.xpi"

    // Absolute path to the temaplate folder.
    // All files from this folder are going to be written in the xpi.
    "template-path": "/addon-sdk/python-lib/cuddlefish/app-extension/"

    // Content of the `install.rdf` to write in the xpi
    "install-rdf": "<?xml version=\"1.0\" encoding=\"utf-8\"?><Description ..."

    // Object containing set of various data necessary to build the xpi and
    // it's harness-options.json manifest file
    "harness-options": {
      // Addon id, "some-unique-string@jetpack", or, UUID
      // like "{79daaae6-5916-49ba-8d3c-f54df65f210b}"
      "jetpackID": "some-unique-string@jetpack"

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
