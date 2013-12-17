/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { start, stop, receive, Input } = require("elmjs/signal");
const { windows } = require("../window/utils");
const { InputPort } = require("./system");

// This is temporary shim until Bug 843235 is fixed. It let's user
// create an signal of `event.target`'s from each window. Given
// `options.type` event listeners for that type will be registered
// on all top level windows that are open or will get opened.
// Event's received by a created signal can be filtered out via
// `options.keep` function, that will be given every `event`
// dispatched.
const WindowEventPort = function WindowEventPort(options) {
  this.type = options.type;
  this.capture = !!options.capture;
  this.InputPort(options);
  this.topic = "domwindowopened";
  this.keep = options.keep;
};
WindowEventPort.prototype = Object.create(InputPort.prototype);
WindowEventPort.prototype.constructor = WindowEventPort;
WindowEventPort.prototype.InputPort = InputPort;
WindowEventPort.prototype.handleEvent = function(event) {
  if (!this.keep || this.keep(event))
    Input.receive(this, event.currentTarget);
};
// Signal receives every `domwindowopened` notification `subject`
// and registers `this` signal as an event listener.
WindowEventPort.prototype[receive] = (input, subject) => {
  subject.addEventListener(input.type, input, input.capture);
};
// Signal is stopped if no more consumers are left or more likely
// if add-on is unloaded. In such case listener is removed from all
// open windows.
WindowEventPort.prototype[stop] = input => {
  for (let target of windows(null, { includePrivates: true }))
    target.removeEventListener(input.type, input, input.capture);

  // Delegate `InputPort.stop` that will remove observer from
  // the observer service etc..
  InputPort.stop(input);
};
// Signal is started once it gains any consumers, in such case
// listener is added to all open windows.
WindowEventPort.prototype[start] = input => {
  for (let target of windows(null, { includePrivates: true }))
    target.addEventListener(input.type, input, input.capture);

  // Gelegate to `InputPort.start` that will register observers
  // and other start realted tasks.
  InputPort.start(input);
};
exports.WindowEventPort = WindowEventPort;
