/* vim:set ts=2 sw=2 sts=2 expandtab */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let { Cc, Ci } = require('chrome');
let { PlainTextConsole } = require('./plain-text-console');
let options = require('@packaging');
let consoleService = Cc['@mozilla.org/consoleservice;1'].getService().
                     QueryInterface(Ci.nsIConsoleService);

// On windows dump does not writes into stdout so cfx can't read thous dumps.
// To workaround this issue we write to a special file from which cfx will
// read and print to the console.
// For more details see: bug-673383
exports.dump = (function define(global) {
  const PR_WRONLY = 0x02;
  const PR_CREATE_FILE = 0x08;
  const PR_APPEND = 0x10;
  let print = Object.getPrototypeOf(global).dump
  if (print) return print;
  if ('logFile' in options) {
    let file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    file.initWithPath(options.logFile);
    let stream = Cc["@mozilla.org/network/file-output-stream;1"].
                 createInstance(Ci.nsIFileOutputStream);
    stream.init(file, PR_WRONLY|PR_CREATE_FILE|PR_APPEND, -1, 0);

    return function print(message) {
      message = String(message);
      stream.write(message, message.length);
      stream.flush();
    };
  }
  return dump;
})(this);

// Override the default Iterator function with one that passes
// a second argument to custom iterator methods that identifies
// the call as originating from an Iterator function so the custom
// iterator method can return [key, value] pairs just like default
// iterators called via the default Iterator function.
exports.Iterator = (function(DefaultIterator) {
  return function Iterator(obj, keysOnly) {
    if ("__iterator__" in obj && !keysOnly)
      return obj.__iterator__.call(obj, false, true);
    return DefaultIterator(obj, keysOnly);
  };
})(Iterator);

// TODO: Remove memory from the globals, as it raises security concerns and
// there is no real reason to favor global memory over
// `require('api-utils/memory')`. For details see: Bug-620559
exports.memory = require('./memory');

// Bug 718230: We need to send console messages to stdout and JS Console
function forsakenConsoleDump(msg, level) {
  exports.dump(msg);

  if (level === "error") {
    let err = Cc["@mozilla.org/scripterror;1"].
              createInstance(Ci.nsIScriptError);
    msg = msg.replace(/^error: /, "");
    err.init(msg, null, null, 0, 0, 0, "Add-on SDK");
    consoleService.logMessage(err);
  }
  else
    consoleService.logStringMessage(msg);
};
exports.console = new PlainTextConsole(forsakenConsoleDump);

// Provide CommonJS `define` to allow authoring modules in a format that can be
// loaded both into jetpack and into browser via AMD loaders.
Object.defineProperty(exports, 'define', {
  // `define` is provided as a lazy getter that binds below defined `define`
  // function to the module scope, so that require, exports and module
  // variables remain accessible.
  configurable: true,
  get: (function() {
    function define(factory) {
      factory = Array.slice(arguments).pop();
      factory.call(this, this.require, this.exports, this.module);
    }

    return function getter() {
      // Redefine `define` as a static property to make sure that module
      // gets access to the same function so that `define === define` is
      // `true`.
      Object.defineProperty(this, 'define', {
        configurable: false,
        value: define.bind(this)
      });
      return this.define;
    }
  })()
});
