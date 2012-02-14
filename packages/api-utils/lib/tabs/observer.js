/* vim:set ts=2 sw=2 sts=2 et: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { EventEmitterTrait: EventEmitter } = require("../events");
const { DOMEventAssembler } = require("../events/assembler");
const { emit } = require("../event/core");
const { Trait } = require("../light-traits");
const { getActiveTab, getTabs, getTabContainers } = require("./utils");
const { browserWindowIterator, isBrowser } = require("../window-utils");
const { observer: windowObserver } = require("../windows/observer");

const EVENTS = {
  "TabOpen": "open",
  "TabClose": "close",
  "TabSelect": "select",
  "TabMove": "move",
  "TabPinned": "pinned",
  "TabUnpinned": "unpinned"
};


// Event emitter objects used to register listeners and emit events on them
// when they occur.
const observer = Trait.compose(DOMEventAssembler, EventEmitter).create({
  /**
   * Events that are supported and emitted by the module.
   */
  supportedEventsTypes: Object.keys(EVENTS),
  /**
   * Function handles all the supported events on all the windows that are
   * observed. Method is used to proxy events to the listeners registered on
   * this event emitter.
   * @param {Event} event
   *    Keyboard event being emitted.
   */
  handleEvent: function handleEvent(event) {
    emit(this, EVENTS[event.type], event.target, event);
  }
});

// Currently gecko does not dispatches any event on the previously selected
// tab before / after "TabSelect" is dispatched. In order to work around this
// limitation we keep track of selected tab and emit "deactivate" event with
// that before emitting "activate" on selected tab.
var selectedTab = null;
function onTabSelect(tab) {
  if (selectedTab !== tab) {
    if (selectedTab) emit(observer, "deactivate", selectedTab);
    if (tab) emit(observer, "activate", selectedTab = tab);
  }
};
observer.on("select", onTabSelect);

// We also observe opening / closing windows in order to add / remove it's
// containers to the observed list.
function onWindowOpen(chromeWindow) {
  if (!isBrowser(chromeWindow)) return; // Ignore if it's not a browser window.
  getTabContainers(chromeWindow).forEach(function (container) {
    observer.observe(container);
  });
}
windowObserver.on("open", onWindowOpen);

function onWindowClose(chromeWindow) {
  if (!isBrowser(chromeWindow)) return; // Ignore if it's not a browser window.
  getTabContainers(chromeWindow).forEach(function (container) {
    observer.ignore(container);
  });
}
windowObserver.on("close", onWindowClose);


// Currently gecko does not dispatches "TabSelect" events when different
// window gets activated. To work around this limitation we emulate "select"
// event for this case.
windowObserver.on("activate", function onWindowActivate(chromeWindow) {
  if (!isBrowser(chromeWindow)) return; // Ignore if it's not a browser window.
  emit(observer, "select", getActiveTab(chromeWindow));
});

// We should synchronize state, since probably we already have at least one
// window open.
for each (let window in browserWindowIterator()) onWindowOpen(window);

exports.observer = observer;
