/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  test.assertEqual(lastPrint(), "warning: " + require("sdk/self").name + ": testing 1 2,3,4\n",
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
  test.assertEqual(tbLines[2], module.uri + " 57");
  test.assertEqual(tbLines[3], "Traceback (most recent call last):");

  prints = [];
  con.trace();
  tbLines = prints[0].split("\n");
  test.assertEqual(tbLines[0], "info: " + require("sdk/self").name + ": Traceback (most recent call last):");
  test.assertEqual(tbLines[4].trim(), "con.trace();");
};
