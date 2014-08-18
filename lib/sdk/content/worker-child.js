/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { emit } = require('../event/core');
const { merge } = require('../util/object');
const { Class } = require('../core/heritage');
const { getInnerId } = require('../window/utils');
const { on: observe } = require('../system/events');
const { EventTarget } = require('../event/target');
const { WorkerSandbox } = require('./sandbox');
const { Ci } = require('chrome');

const EVENTS = {
  'content-page-hidden': 'pagehide',
  'chrome-page-hidden': 'pagehide',
  'content-page-shown': 'pageshow',
  'chrome-page-shown': 'pageshow',
  'inner-window-destroyed': ''
}

const WorkerChild = Class({
  implements: [EventTarget],
  initialize(options, window, parent) {
    merge(this, options);

    this.port = EventTarget();
    this.port.on('*', emit.bind(emit, parent.port));
    this.on('*', emit.bind(emit, parent));

    this.id = getInnerId(window);
    Object.keys(EVENTS).forEach(type => observe(type, this.observe.bind(this)));

    this.sandbox = WorkerSandbox(this, window);
    emit(this, 'attach', window);
  },
  // notifications
  observe({ type, subject }) {
    if (!this.sandbox)
      return;
    let event = EVENTS[type];
    let window = event && subject.defaultView;
    if (event && window && this.id === getInnerId(window)) {
      this.sandbox.emitSync(event);
      emit(this, event);
    }
    if (!event && this.id === subject.QueryInterface(Ci.nsISupportsPRUint64).data)
      this.destroy();
  },
  // detach + destroy: unload and release the sandbox
  destroy(reason) {
    if (!this.sandbox)
      return;
    this.sandbox.destroy(reason);
    this.sandbox = null;
    emit(this, 'detach');
    this.port.off();
    this.off();
  }
})
exports.WorkerChild = WorkerChild;
