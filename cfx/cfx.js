/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require("chrome");
const AddonInstaller = require("api-utils/addon/installer");
const file = require("api-utils/file");
const system = require("api-utils/system");
const xpi = require("./xpi");

function getOptions() {
  let optionsFile = system.env["CFX_OPTIONS_FILE"];
  if (!optionsFile) {
    throw new Error("Unable to locate options file, " +
                    "environment variable is not set.");
  }
  let data = null;
  try {
    data = file.read(optionsFile);
  }
  catch(e) {
    throw Error("Unable to read options file: " + optionsFile + "\n" + e);
  }
  return JSON.parse(data);
}

const COMMANDS = {
  "install-xpi": function (options) {
    AddonInstaller.install(options.path)
                  .then(
                    null,
                    function onError(error) {
                      console.log("Failed to install addon: " + error);
                    });
  },
  "build-xpi": function (options) {
    xpi.build(options);
  },
  "no-quit": function (options) {
    // Test command in order to simulate a run that never quits
    Cc['@mozilla.org/toolkit/app-startup;1'].
      getService(Ci.nsIAppStartup).
      enterLastWindowClosingSurvivalArea();
  }
};

function main() {
  try {
    let { command, options } = getOptions();
    if (command in COMMANDS)
      COMMANDS[command](options);
    else
      console.log("Unknown cfxjs command '" + command + "'");
  }
  catch(e) {
    if ("cfxError" in e) {
      // Stacktrace isn't usefull in case of custom cfx exceptions, prints
      // custom message instead. These exceptions are implemented in
      // exception module.
      dump(e.toString() + "\n");
    }
    else {
      console.error("Unknown internal error in cfx.js:");
      console.exception(e);
    }
    system.exit(system.E_FORCE);
  }
}

if (require.main === module)
  main();
