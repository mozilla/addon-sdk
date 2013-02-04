/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "stable"
};

const { when: unload } = require("./system/unload");
const { loaded, interactive } = require("./window/state");
const { Class } = require("./core/heritage");
const { Disposable } = require("./core/disposable");
const { validationAttributes } = require("./content/loader");
const { Worker } = require("./content/worker");
const { EventTarget } = require("./event/target");
const { emit, off } = require("./event/core");

const { List, addListItem, removeListItem, hasListItem } = require("./util/list");

const { MatchPattern } = require("./page-mod/match-pattern");
const styleSheet = require("./page-mod/style-sheet");
const events = require("./system/events");

const { validateOptions : validate } = require("./deprecated/api-utils");
const { extend } = require("./util/object");
const { readURISync } = require("./net/url");
const { getFrames } = require("./window/utils");
const { getTabs, getTabContentWindow, getTabForContentWindow,
        getURI: getTabURI } = require("./tabs/utils");
const { has, hasAny, add, remove } = require("./util/array");
const { ns } = require("./core/namespace")

// Valid values for `attachTo` option
const VALID_ATTACHTO_OPTIONS = ["existing", "top", "frame"];

// contentStyle* / contentScript* are sharing the same validation constraints,
// so they can be mostly reused, except for the messages.
const validStyleOptions = {
  contentStyle: extend(validationAttributes.contentScript, {
    msg: "The `contentStyle` option must be a string or an array of strings."
  }),
  contentStyleFile: extend(validationAttributes.contentScriptFile, {
    msg: "The `contentStyleFile` option must be a local URL or an array of URLs"
  })
};

const rules = ns();
const styles = ns();
const disposable = ns();

// Registry for all the active page mods.
var mods = [];

const Rules = Class({
  implements: [EventTarget],
  extends: List,
  initializeList: List.prototype.initialize,
  initialize: function() {
    rules(this).patterns = {};
    this.initializeList();
  },
  add: function() {
    let patterns = rules(this).patterns;
    let include = this;
    Array.slice(arguments).filter(function(rule) {
      return !hasListItem(include, rule);
    }).forEach(function onAdd(rule) {
      // registering rule to the rules registry
      patterns[rule] = new MatchPattern(rule);
      addListItem(include, rule);
      emit(include, "add", rule);
    });
  },
  remove: function() {
    let patterns = rules(this).patterns;
    let include = this;
    Array.slice(arguments).filter(function() {
      return !hasListItem(include, rule);
    }).forEach(function onRemove(rule) {
      patterns[rule] = null
      removeListItem(include, rule);
      emit(include, "remove", rule);
    });
  },
});

function patterns(include) {
  // Utility function returns array of match-patterns for the given
  // page mod include rules.
  var hash = rules(include).patterns;
  return Object.keys(hash).map(function(id) {
    return hash[id];
  });
}

function isMatching(patterns, uri) {
  // Returns true if `uri` matches any of the give match-patterns.
  return patterns.some(function(pattern) { return pattern.test(uri); });
}

function applyToExisting(mod) {
  // Applies page mod to the already existing applicable tabs.

  // Select all tabs that given page-mod's include pattern matches
  // and map them to the content windows loaded in them.
  let windows = getTabs().filter(function (tab) {
    return isMatching(patterns(mod.include), getTabURI(tab));
  }).map(getTabContentWindow);

  windows.forEach(function (window) {
    if (isTop(mod)) attachWorker(mod, window);
    if (isFrame(mod)) getFrames(window).forEach(function(frame) {
      attachWorker(mod, frame);
    });
  });
}

function isDisposed(target) {
  return disposable(target).disposed
}

function attachWorker(mod, window) {
  // Choose the timing based on mode configuration, wait for it and then
  // attach a worker.
  var ready = mod.contentScriptWhen === "end" ? loaded(window) :
              interactive(window);

  ready.then(function onWindowReady() {
    // Make sure page-mod has not being disposed while we were waiting for the
    // document state change.
    if (!isDisposed(mod)) {
      let worker = Worker({
        window: window,
        contentScript: mod.contentScript,
        contentScriptFile: mod.contentScriptFile,
        contentScriptOptions: mod.contentScriptOptions
      });

      emit(mod, "attach", worker);
      worker.once("detach", function() {
        emit(mod, "detach", worker);
        worker.destroy();
      });
    }
  }).then(null, console.exception);
}

function isTop(mod) { return has(mod.attachTo, "top"); }
function isFrame(mod) { return has(mod.attachTo, "frame"); }
function isExistingApplicable(mod) { return has(mod.attachTo, "existing"); }

// Utility function synchronizes mod's style rules with a styleSheet service.
function updateStyleRules(mod) {
  var sheet = styles(mod);
  if (sheet.uri) styleSheet.unregister(sheet.uri);
  sheet.uri = styleSheet.make(patterns(mod.include), sheet.rules);
  styleSheet.register(sheet.uri);
}

const PageMod = Class({
  implements: [Disposable],
  extends: EventTarget,
  attachTo: null,
  include: null,

  setup: function setup(options) {
    // Register page mod instance.
    add(mods, this);

    disposable(this).disposed = false;

    options = options || {};

    let { contentStyle, contentStyleFile } = validate(options, validStyleOptions);

    if ("contentScript" in options)
      this.contentScript = options.contentScript;
    if ("contentScriptFile" in options)
      this.contentScriptFile = options.contentScriptFile;
    if ("contentScriptOptions" in options)
      this.contentScriptOptions = options.contentScriptOptions;
    if ("contentScriptWhen" in options)
      this.contentScriptWhen = options.contentScriptWhen;
    if ("onAttach" in options)
      this.on("attach", options.onAttach);
    if ("onError" in options)
      this.on("error", options.onError);
    if ("attachTo" in options) {
      if (typeof options.attachTo == "string")
        this.attachTo = [options.attachTo];
      else if (Array.isArray(options.attachTo))
        this.attachTo = options.attachTo;
      else
        throw new Error("The `attachTo` option must be a string or an array " +
                        "of strings.");

      let isValidAttachToItem = function isValidAttachToItem(item) {
        return typeof item === "string" &&
               VALID_ATTACHTO_OPTIONS.indexOf(item) !== -1;
      }
      if (!this.attachTo.every(isValidAttachToItem))
        throw new Error("The `attachTo` option valid accept only following " +
                        "values: "+ VALID_ATTACHTO_OPTIONS.join(", "));
      if (!hasAny(this.attachTo, ["top", "frame"]))
        throw new Error("The `attachTo` option must always contain at least" +
                        " `top` or `frame` value");
    }
    else {
      this.attachTo = ["top", "frame"];
    }

    let include = options.include;
    let rules = Rules();
    this.include = rules;

    if (Array.isArray(include)) rules.add.apply(rules, include);
    else rules.add(include);

    let styleRules = "";

    if (contentStyleFile)
      styleRules = [].concat(contentStyleFile).map(readURISync).join("");

    if (contentStyle)
      styleRules += [].concat(contentStyle).join("");

    if (styleRules) {
      var sheet = styles(this);
      sheet.rules = styleRules;

      var upadateStyles = updateStyleRules.bind(null, this);
      rules.on("add", upadateStyles);
      rules.on("remove", upadateStyles);
      upadateStyles(this);
    }

    if (isExistingApplicable(this)) applyToExisting(this);
  },
  dispose: function dispose() {
    remove(mods, this);
    disposable(this).disposed = true;
    off(this.include);
    styleSheet.unregister(styles(this).uri);
    rules(this.include).patterns = {};
  }
});
exports.PageMod = PageMod;

// Handles document creations and attaches workers that match
// created documents.
function onDocumentInserted(event) {
  let document = event.subject;
  let window = document.defaultView;
  // XML documents don't have windows, and we don't yet support them.
  if (!window) return;
  // We apply only on documents in tabs of Firefox
  if (!getTabForContentWindow(window)) return;

  let isTopDocument = window.top === window;
  let uri = document.URL;

  // Select all the matching mads and attach workers to them.
  mods.filter(function(mod) {
    return isMatching(patterns(mod.include), uri) &&
           ((isTopDocument && isTop(mod)) || (!isTopDocument && isFrame(mod)));
  }).forEach(function(mod) {
    attachWorker(mod, window);
  });
}

events.on("document-element-inserted", onDocumentInserted, true);
unload(function() {
  mods = null;
  events.off("document-element-inserted", onDocumentInserted);
});
