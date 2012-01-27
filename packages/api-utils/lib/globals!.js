/* vim:set ts=2 sw=2 sts=2 expandtab */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
