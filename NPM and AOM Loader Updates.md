# NPM and AOM Loader Updates

This document outlines the process of updating the core loader module of the Add-on SDK so that it will work both with NPM and with the Add-on Manager
integration project.

## Use Cases

* Pointing the AOM at a unpacked add-on in development.
* Handling packed (via `cfx xpi` or **`zip`**) add-ons that will be marked with `"unpack": true/false` in the `package.json` file for the add-on.
* Supporting modules included via `npm install` which are found in the `node_modules` directory.
* Supporting the current 1.14 usage of built-on sdk packages ?


## Current Logic

### Current `require` Logic

1. Throw if `id` is not provided.
2. Resolve relative `id`s, and alias from `mapping.json`.
3. Find uri using `paths` variable which comes from `options` in `Loader(options)`.
3a. Throw if a uri cannot be resolved
4. if module is cached is cahce
5. If uri is a JSONish uri then try parsing it as JSON
6. Otherwise (assume it exists) load and cache it (throwing when failing to read if it dne).

#### Building of `paths` variable
1. Defaults of `.\` to resource uri `{name}/lib` folder, and same for the `.\tests` prefix.  Also a blank prefix is added which points to internal SDK modules parfent folder `resource://gre/modules/commonjs/`
2. Maps each add-on package lib (listed in `harness-options.json` `metadata` key) to resource uri `{name}/ib` and same for tests.
3. If sdk is bundled with the addon, then overwirte blank mapping.
4. Check prefs for id specific module path overwrites so that local sdk files may be used for testing use cases.

### New `require` Logic

In the Add-on Manager integration project

1. If the require starts with `./` or `../` then use relative mapping to find the module
  * If the alias matches and a module is not found, then throw an error
2. Check aliased mappings (found in package.json)
  * If the alias matches and a module is not found, then throw an error
  * This would be easy if it points to a file, but should also support pointing to a directory, reading package.json, finding main, defaulting to index.js, which would require mapping res
3. Check https://github.com/mozilla/addon-sdk/blob/master/mapping.json and continue if there is no exact match.
4. If the prefix is `sdk` then assume the module is a built-in sdk module.
  * If the alias matches and a module is not found, then throw an error
5. Node stuff
* Node stuff requires additional support for directory (if package.json, use main entry, otherwise, use index.js), which will be done in step 1, but we dont need this right away. this requires mapping resolution. the remaining node stuff (absolute path to modules used) would also need mapping res
6. Check locally as if `./` were used.

See this use case in the wild: https://github.com/mozilla/lightbeam/blob/master/lib/ui.js#L11
