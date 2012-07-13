/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Cc,Ci} = require("chrome");

function stringify(arg) {
  try {
    return String(arg);
  }
  catch(ex) {
    return "<toString() error>";
  }
}

function stringifyArgs(args) {
  return Array.map(args, stringify).join(" ");
}

function message(print, level, args) {
  print(level + ": " + stringifyArgs(args) + "\n", level);
}

var Console = exports.PlainTextConsole = function PlainTextConsole(print) {
  if (!print)
    print = dump;
  if (print === dump) {
    // If we're just using dump(), auto-enable preferences so
    // that the developer actually sees the console output.
    var prefs = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefBranch);
    prefs.setBoolPref("browser.dom.window.dump.enabled", true);
  }
  this.print = print;

  // Binding all the public methods to an instance so that they can be used
  // as callback / listener functions straightaway.
  this.log = this.log.bind(this);
  this.info = this.info.bind(this);
  this.warn = this.warn.bind(this);
  this.error = this.error.bind(this);
  this.debug = this.debug.bind(this);
  this.exception = this.exception.bind(this);
  this.trace = this.trace.bind(this);
};

Console.prototype = {
  log: function log() {
    message(this.print, "info", arguments);
  },

  info: function info() {
    message(this.print, "info", arguments);
  },

  warn: function warn() {
    message(this.print, "warning", arguments);
  },

  error: function error() {
    message(this.print, "error", arguments);
  },

  debug: function debug() {
    message(this.print, "debug", arguments);
  },

  exception: function exception(e) {
    var fullString = ("An exception occurred.\n" +
                      require("./traceback").format(e) + "\n" + e);
    this.error(fullString);
  },

  trace: function trace() {
    var traceback = require("./traceback");
    var stack = traceback.get();
    stack.splice(-1, 1);
    message(this.print, "info", [traceback.format(stack)]);
  }
};
