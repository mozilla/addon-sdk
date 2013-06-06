/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

// The Button module currently supports only Firefox.
// See: https://bugzilla.mozilla.org/show_bug.cgi?id=jetpack-panel-apps
module.metadata = {
  'stability': 'experimental',
  'engines': {
    'Firefox': '*'
  }
};

const { Ci } = require('chrome');

const events = require('../event/utils');
const { events: browserEvents } = require('../browser/events');
const { events: tabEvents } = require('../tab/events');

const { windows, isInteractive, getMostRecentBrowserWindow } = require('../window/utils');
const { BrowserWindow, browserWindows } = require('../windows');
const { windowNS } = require('../window/namespace');
const { Tab } = require('../tabs/tab');
const { getActiveTab, getOwnerWindow, getTabs, getTabId } = require("../tabs/utils");

const { Class } = require('../core/heritage');
const { freeze } = Object;
const { merge } = require('../util/object');
const { contract } = require('../util/contract');
const { on, off, emit, setListeners } = require('../event/core');
const { EventTarget } = require('../event/target');

const { optional } = require('../deprecated/api-utils');

const { add, remove, has, clear, iterator } = require("../lang/weak-set");

const components = new WeakMap();

/**
 * temporary
 */
function getChromeWindow(sdkWindow) windowNS(sdkWindow).window;

/**
 * temporary
 */
function getChromeTab(sdkTab) {
  for (let tab of getTabs()) {
    if (sdkTab.id === getTabId(tab))
      return tab;
  }
  return null;
}

function copy(source) {
  let descriptor = {};
  // `Boolean` converts the first parameter to a boolean value. Any object is
  // converted to `true` where `null` and `undefined` becames `false`. Therefore
  // the `filter` method will keep only objects that are defined and not null.
  Array.slice(arguments, 1).filter(Boolean).forEach(function onEach(properties) {
    Object.getOwnPropertyNames(properties).forEach(function(name) {
      source[name] = properties[name];
    });
  });
  return source;
}


function getStateFor(component, target) {
  if (!components.has(component))
    return null;

  let states = components.get(component);

  if (target) {
    console.log("has a target");

    if (target.tagName === "TAB")
      console.log("the target is a tab")
      if (states.has(target)) {
        console.log("we have a tab state")
        return states.get(target);
      }
      else {
        console.log("we do not have a tab state, try with window")

        target = getOwnerWindow(target);
      }

    if (target instanceof Ci.nsIDOMWindow && states.has(target)) {
      console.log("we have a window state");

      return states.get(target, null);
    }
  }

  console.log("we do not have a window state, returns component state")
  return states.get(component);
}

function setStateFor(component, target, state) {
  if (!components.has(component))
    components.set(component, new WeakMap());

  let states = components.get(component);
  let currentState = states.get(target);

  states.set(target, freeze(merge({}, currentState, state)));
}

const Component = Class({
  initialize: function(options) {
    add(components, this);

    this.stateFor(this, options);
  },
  stateFor: function stateFor(target, state) {
    if (target instanceof BrowserWindow) {
      console.log("it's a window!");
      target = getChromeWindow(target);
    }
    else if (target instanceof Tab) {
      console.log("it's a Tab!");
      target = getChromeTab(target);
    }
    else if (target === this) {
      console.log("it's me!")
    }

    if (arguments.length < 2)
      return getStateFor(this, target);

    setStateFor(this, target, state);

    let interactiveWindows = windows('navigator:browser', { includePrivate: true}).filter(isInteractive);

    for (let window of interactiveWindows) {
      emit(this, "render", getStateFor(this, getActiveTab(window)));
    }
  }
});
exports.Component = Component;

function properties(contract) {
  let { rules } = contract;
  let descriptor = Object.keys(rules).reduce(function(descriptor, name) {
    descriptor[name] = {
      get: function() { return getStateFor(this)[name] },
      set: function(value) {
        let change = copy({}, this.stateFor());
        change[name] = value;
        this.stateFor(this, contract(change));
      }
    }
    return descriptor;
  }, {});
  return Object.create(Object.prototype, descriptor);
}

exports.properties = properties;

let tabSelect = events.filter(tabEvents, function(e) e.type === "TabSelect");
let tabClose = events.filter(tabEvents, function(e) e.type === "TabClose");
let windowOpen = events.filter(browserEvents, function(e) e.type === "load");
let windowClose = events.filter(browserEvents, function(e) e.type === "close");

let close = events.merge([tabClose, windowClose]);

on(windowOpen, "data", function({target: window}) {
  let tab = getActiveTab(window);

  for (let component of iterator(components)) {
    emit(component, "render", getStateFor(component, tab));
  }
});

on(tabSelect, "data", function({target: tab}) {
  for (let component of iterator(components)) {
    emit(component, "render", getStateFor(component, tab));
  }
});

on(close, "data", function({target}) {
  for (let component of iterator(components)) {
    components.get(component).delete(target);
  }
});
