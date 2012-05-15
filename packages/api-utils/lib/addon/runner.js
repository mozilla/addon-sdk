/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const { Cc, Ci } = require('chrome');
const { load, override, Sandbox, evaluate } = require('@loader');
const { once } = require('../system/events');
const { exit, env, staticArgs, name } = require('../system');
const { when: unload } = require('../unload');
const globals = require('../globals!');
const options = require('@packaging');

const NAME2TOPIC = {
  'Firefox': 'sessionstore-windows-restored',
  'SeaMonkey': 'sessionstore-windows-restored',
  'Thunderbird': 'mail-startup-done',
  '*': 'final-ui-startup'
};

// Gets the topic that fit best as application startup event, in according with
// the current application (e.g. Firefox, Fennec, Thunderbird...)
const APP_STARTUP = NAME2TOPIC[name] || NAME2TOPIC['*'];

// Initializes default preferences
function setDefaultPrefs() {
  const prefs = Cc["@mozilla.org/preferences-service;1"].
                getService(Ci.nsIPrefService).
                QueryInterface(Ci.nsIPrefBranch2);
  const branch = prefs.getDefaultBranch("");
  const sandbox = Sandbox({
    name: options.prefsURI,
    prototype: {
      pref: function(key, val) {
        switch (typeof val) {
          case "boolean":
            branch.setBoolPref(key, val);
            break;
          case "number":
            if (val % 1 == 0) // number must be a integer, otherwise ignore it
              branch.setIntPref(key, val);
            break;
          case "string":
            branch.setCharPref(key, val);
            break;
        }
      }
    }
  });
  // load preferences.
  evaluate(sandbox, options.prefsURI);
}

function wait(reason, options) {
  once(APP_STARTUP, function() {
    startup(null, options);
  });
}

function startup(reason, options) {
  if (reason === 'startup')
    return wait(reason, options);

  // Inject globals ASAP in order to have console API working ASAP
  let loader = options.loader;
  override(loader.globals, globals);

  // Try initializing localization module before running main module. Just print
  // an exception in case of error, instead of preventing addon to be run.
  try {
    // Do not enable HTML localization while running test as it is hard to
    // disable. Because unit tests are evaluated in a another Loader who
    // doesn't have access to this current loader.
    if (options.loader.main.id !== "test-harness/run-tests")
      require("api-utils/l10n/html").enable();
  } catch(error) {
    console.exception(error);
  }
  try {
    // TODO: When bug 564675 is implemented this will no longer be needed
    // Always set the default prefs, because they disappear on restart
    setDefaultPrefs();

    // this is where the addon's main.js finally run.
    let program = load(loader, loader.main).exports;

    if (typeof(program.onUnload) === 'function')
      unload(program.onUnload);

    if (typeof(program.main) === 'function') {

      program.main({
        loadReason: options.loadReason,
        staticArgs: staticArgs 
      }, { 
        print: function print(_) { dump(_ + '\n') },
        quit: exit 
      });
    }
  } catch (error) {
    console.exception(error);
    throw error;
  }
}
exports.startup = startup;

// If add-on is lunched via `cfx run` we need to use `system.exit` to let
// cfx know we're done (`cfx test` will take care of exit so we don't do
// anything here).
if (env.CFX_COMMAND === 'run') {
  unload(function(reason) {
    if (reason === 'shutdown')
      exit(0);
  });
}
