/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cc, Ci } = require("chrome");
const self = require("../self");
const { sourceURI } = require("./traceback")
const prefs = require("../preferences/service");

const LEVELS = {
  "all": Number.MIN_VALUE,
  "debug": 20000,
  "info": 30000,
  "warn": 40000,
  "error": 50000,
  "off": Number.MAX_VALUE,
};
const DEFAULT_LOG_LEVEL = "error";
const ADDON_LOG_LEVEL_PREF = "extensions." + self.id + ".sdk.console.logLevel";
const SDK_LOG_LEVEL_PREF = "extensions.sdk.console.logLevel";

let logLevel;

function setLogLevel() {
  logLevel = prefs.get(ADDON_LOG_LEVEL_PREF, prefs.get(SDK_LOG_LEVEL_PREF,
                                                       DEFAULT_LOG_LEVEL));
}
setLogLevel();

let logLevelObserver = {
  observe: function(subject, topic, data) {
    setLogLevel();
  }
};
let branch = Cc["@mozilla.org/preferences-service;1"].
             getService(Ci.nsIPrefService).
             getBranch(null);
branch.addObserver(ADDON_LOG_LEVEL_PREF, logLevelObserver, false);
branch.addObserver(SDK_LOG_LEVEL_PREF, logLevelObserver, false);

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

function message(print, level, args, name) {
  if (LEVELS[level] < LEVELS[logLevel])
    return;

  print(level + ": " + name + ": " + stringifyArgs(args) + "\n", level);
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
    message(this.print, "info", arguments, self.name);
  },

  info: function info() {
    message(this.print, "info", arguments, self.name);
  },

  warn: function warn() {
    message(this.print, "warn", arguments, self.name);
  },

  error: function error() {
    message(this.print, "error", arguments, self.name);
  },

  debug: function debug() {
    message(this.print, "debug", arguments, self.name);
  },

  exception: function exception(e) {
    var fullString = ("An exception occurred.\n" +
                      e.name + ": " + e.message + "\n" +
                      sourceURI(e.fileName) + " " +
                      e.lineNumber + "\n" +
                      require("./traceback").format(e));
    this.error(fullString);
  },

  trace: function trace() {
    var traceback = require("./traceback");
    var stack = traceback.get();
    stack.splice(-1, 1);
    message(this.print, "info", [traceback.format(stack)], self.name);
  }
};
