# cfx.js

cfx.js is an SDK addon meant to replace python command line application.
This addon is currently quite limited but it is going to implement all features
of cfx python application in order to remove python dependency.
It currently just allow to build an XPI file.
For now, it is not meant to be used standalone, it is an helper addon used by
add-on sdk `cfx` command line application.


# How does it work

 * cfx python application set `CFX_OPTIONS_FILE` environnement variable to an
   absolute path to a JSON file that contains necessary information to execute
   some commands,
 * Then, cfx python application run it through the xulrunner template,
 * Finally, the addon reads JSON from `CFX_OPTIONS_FILE` and performs tasks
   described by it.

(We aren't putting JSON content into environnement variable as the size of an
 environnement variable is quite limited)


# How to build it and install it

 * Activate your SDK environnement

        $ source bin/activate (linux/mac)
           - or -
        $ bin\activate (window)

 * Go to cfx.js directory

        $ cd cfx/

 * Generate cfx.js xpi

        $ cfx xpi

 * Then, copy it to the xulrunner application template

        $ mv cfx.xpi xulrunner-app/


# Expected JSON Object passed to cfx.js

    {
      "command": "string" // Name of the command to execute
      "options": "object" // Arguments needed to execute this command
    }

## Supported commands

### install-xpi

   Install a given xpi into the currently running firefox/xulrunner application

   Required `options` object:
   {
     "path": "string" // Absolute path to the xpi to install
   }

### build-xpi

  Build an addon SDK addon.

  Required `options` object:
  {
    "xpi-path": "string" // Absolute path to the xpi we want to build
    "template-path": "string" // Absolute path to the temaplate folder.
                           // All files from this folder are going to be
                           // written in the xpi
    "install-rdf": "string" // Content of the `install.rdf` to write in the xpi
    "harness-options": {
      "icon": "string"   // Absolute path the the default icon for this addon
      "icon64": "string" // Same thing, but for a 64px version of it
      "packages": {      // A dictionnary of packages. keys are packages names
                         // Values are another dictionnary with packages section
                         // folders. These folders are written into `resources`
                         // directory in the xpi
        "api-utils": { // package name
          "test": section, // section name => absolute path to it
          "lib": section
        }
      },
      "locale": { // A dictionnary of available locales for this addon
                  // keys are language code and values are another dictionnary
                  // with all translated strings
        "en-US": {// language code
          "key": "translation" // key to translate => translated key
        }
      }
      // All these `harness-options` attributes are used to build the xpi
      // but you can pass other attributes. They will be written into
      // `harness-options.json` at xpi's root folder
    },
    "extra-harness-options": "dictionnary" // A set of additional attributes to
                                           // write into `harness-options.json`
  }
