/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const prefs = require("sdk/preferences/service");
const { id } = require("sdk/self");

const ADDON_LOG_LEVEL_PREF = "extensions." + id + ".sdk.console.logLevel";
const SDK_LOG_LEVEL_PREF = "extensions.sdk.console.logLevel";

const HAS_ORIGINAL_ADDON_LOG_LEVEL = prefs.has(ADDON_LOG_LEVEL_PREF);
const ORIGINAL_ADDON_LOG_LEVEL = prefs.get(ADDON_LOG_LEVEL_PREF);
const HAS_ORIGINAL_SDK_LOG_LEVEL = prefs.has(SDK_LOG_LEVEL_PREF);
const ORIGINAL_SDK_LOG_LEVEL = prefs.get(SDK_LOG_LEVEL_PREF);

exports.testPlainTextConsole = function(test) {
  var prints = [];
  function print(message) {
    prints.push(message);
  }
  function lastPrint() {
    var last = prints.slice(-1)[0];
    prints = [];
    return last;
  }

  prefs.set(SDK_LOG_LEVEL_PREF, "all");

  var Console = require("sdk/console/plain-text").PlainTextConsole;
  var con = new Console(print);

  test.pass("PlainTextConsole instantiates");

  con.log('testing', 1, [2, 3, 4]);
  test.assertEqual(lastPrint(), "info: " + require("sdk/self").name + ": testing 1 2,3,4\n",
                   "PlainTextConsole.log() must work.");

  con.info('testing', 1, [2, 3, 4]);
  test.assertEqual(lastPrint(), "info: " + require("sdk/self").name + ": testing 1 2,3,4\n",
                   "PlainTextConsole.info() must work.");

  con.warn('testing', 1, [2, 3, 4]);
  test.assertEqual(lastPrint(), "warn: " + require("sdk/self").name + ": testing 1 2,3,4\n",
                   "PlainTextConsole.warn() must work.");

  con.error('testing', 1, [2, 3, 4]);
  test.assertEqual(lastPrint(), "error: " + require("sdk/self").name + ": testing 1 2,3,4\n",
                   "PlainTextConsole.error() must work.");

  con.debug('testing', 1, [2, 3, 4]);
  test.assertEqual(lastPrint(), "debug: " + require("sdk/self").name + ": testing 1 2,3,4\n",
                   "PlainTextConsole.debug() must work.");

  con.log('testing', undefined);
  test.assertEqual(lastPrint(), "info: " + require("sdk/self").name + ": testing undefined\n",
                   "PlainTextConsole.log() must stringify undefined.");

  con.log('testing', null);
  test.assertEqual(lastPrint(), "info: " + require("sdk/self").name + ": testing null\n",
                   "PlainTextConsole.log() must stringify null.");

  con.log("testing", { toString: function() "obj.toString()" });
  test.assertEqual(lastPrint(), "info: " + require("sdk/self").name + ": testing obj.toString()\n",
                   "PlainTextConsole.log() must stringify custom toString.");

  con.log("testing", { toString: function() { throw "fail!"; } });
  test.assertEqual(lastPrint(), "info: " + require("sdk/self").name + ": testing <toString() error>\n",
                   "PlainTextConsole.log() must stringify custom bad toString.");

  con.exception(new Error("blah"));

  var tbLines = prints[0].split("\n");
  test.assertEqual(tbLines[0], "error: " + require("sdk/self").name + ": An exception occurred.");
  test.assertEqual(tbLines[1], "Error: blah");
  test.assertEqual(tbLines[2], module.uri + " 70");
  test.assertEqual(tbLines[3], "Traceback (most recent call last):");

  prints = [];
  con.trace();
  tbLines = prints[0].split("\n");
  test.assertEqual(tbLines[0], "info: " + require("sdk/self").name + ": Traceback (most recent call last):");
  test.assertEqual(tbLines[4].trim(), "con.trace();");

  let debugMessage = "debug: " + require("sdk/self").name + ": \n";
  let infoMessage = "info: " + require("sdk/self").name + ": \n";
  let warnMessage = "warn: " + require("sdk/self").name + ": \n";
  let errorMessage = "error: " + require("sdk/self").name + ": \n";

  prefs.set(SDK_LOG_LEVEL_PREF, "all");
  con.debug("");
  test.assertEqual(lastPrint(), debugMessage,
                   "when log level is 'all', debug() prints");
  con.log("");
  test.assertEqual(lastPrint(), infoMessage,
                   "when log level is 'all', log() prints");
  con.info("");
  test.assertEqual(lastPrint(), infoMessage,
                   "when log level is 'all', info() prints");
  con.warn("");
  test.assertEqual(lastPrint(), warnMessage,
                   "when log level is 'all', warn() prints");
  con.error("");
  test.assertEqual(lastPrint(), errorMessage,
                   "when log level is 'all', error() prints");

  prefs.set(SDK_LOG_LEVEL_PREF, "debug");
  con.debug("");
  test.assertEqual(lastPrint(), debugMessage,
                   "when log level is 'debug', debug() prints");
  con.log("");
  test.assertEqual(lastPrint(), infoMessage,
                   "when log level is 'debug', log() prints");
  con.info("");
  test.assertEqual(lastPrint(), infoMessage,
                   "when log level is 'debug', info() prints");
  con.warn("");
  test.assertEqual(lastPrint(), warnMessage,
                   "when log level is 'debug', warn() prints");
  con.error("");
  test.assertEqual(lastPrint(), errorMessage,
                   "when log level is 'debug', error() prints");

  prefs.set(SDK_LOG_LEVEL_PREF, "info");
  con.debug("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'info', debug() doesn't print");
  con.log("");
  test.assertEqual(lastPrint(), infoMessage,
                   "when log level is 'info', log() prints");
  con.info("");
  test.assertEqual(lastPrint(), infoMessage,
                   "when log level is 'info', info() prints");
  con.warn("");
  test.assertEqual(lastPrint(), warnMessage,
                   "when log level is 'info', warn() prints");
  con.error("");
  test.assertEqual(lastPrint(), errorMessage,
                   "when log level is 'info', error() prints");

  prefs.set(SDK_LOG_LEVEL_PREF, "warn");
  con.debug("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'warn', debug() doesn't print");
  con.log("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'warn', log() doesn't print");
  con.info("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'warn', info() doesn't print");
  con.warn("");
  test.assertEqual(lastPrint(), warnMessage,
                   "when log level is 'warn', warn() prints");
  con.error("");
  test.assertEqual(lastPrint(), errorMessage,
                   "when log level is 'warn', error() prints");

  prefs.set(SDK_LOG_LEVEL_PREF, "error");
  con.debug("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'error', debug() doesn't print");
  con.log("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'error', log() doesn't print");
  con.info("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'error', info() doesn't print");
  con.warn("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'error', warn() doesn't print");
  con.error("");
  test.assertEqual(lastPrint(), errorMessage,
                   "when log level is 'error', error() prints");

  prefs.set(SDK_LOG_LEVEL_PREF, "off");
  con.debug("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'off', debug() doesn't print");
  con.log("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'off', log() doesn't print");
  con.info("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'off', info() doesn't print");
  con.warn("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'off', warn() doesn't print");
  con.error("");
  test.assertEqual(lastPrint(), null,
                   "when log level is 'off', error() doesn't print");

  prefs.set(SDK_LOG_LEVEL_PREF, "off");
  prefs.set(ADDON_LOG_LEVEL_PREF, "all");
  con.debug("");
  test.assertEqual(lastPrint(), debugMessage,
                   "addon log level 'all' overrides SDK log level 'off'");

  prefs.set(SDK_LOG_LEVEL_PREF, "all");
  prefs.set(ADDON_LOG_LEVEL_PREF, "off");
  con.error("");
  test.assertEqual(lastPrint(), null,
                   "addon log level 'off' overrides SDK log level 'all'");

  if (HAS_ORIGINAL_ADDON_LOG_LEVEL)
    prefs.set(ADDON_LOG_LEVEL_PREF, ORIGINAL_ADDON_LOG_LEVEL);
  else
    prefs.reset(ADDON_LOG_LEVEL_PREF);

  if (HAS_ORIGINAL_SDK_LOG_LEVEL)
    prefs.set(SDK_LOG_LEVEL_PREF, ORIGINAL_SDK_LOG_LEVEL);
  else
    prefs.reset(SDK_LOG_LEVEL_PREF);
};
