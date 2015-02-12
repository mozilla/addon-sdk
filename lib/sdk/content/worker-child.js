/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { merge } = require('../util/object');
const { Class } = require('../core/heritage');
const { EventTarget } = require('../event/target');
const { getInnerId, getByInnerId } = require('../window/utils');
const { instanceOf, isObject } = require('../lang/type');
const { on: observe } = require('../system/events');
const { when } = require('../system/unload');
const { WorkerSandbox } = require('./sandbox');
const { Ci } = require('chrome');
const { process } = require('../remote/child');

const EVENTS = {
  'chrome-page-shown': 'pageshow',
  'content-page-shown': 'pageshow',
  'chrome-page-hidden': 'pagehide',
  'content-page-hidden': 'pagehide',
  'inner-window-destroyed': 'detach',
}

const WorkerChild = Class({
  implements: [EventTarget],
  initialize(options) {
    merge(this, options);

    this.port = EventTarget();
    this.port.on('*', this.send.bind(this, 'event'));
    this.on('*', this.send.bind(this));

    this.observe = this.observe.bind(this);

    for (let topic in EVENTS)
      observe(topic, this.observe);

    this.receive = this.receive.bind(this);
    process.port.on('sdk/worker/message', this.receive);

    let window = getByInnerId(this.window);
    this.sandbox = WorkerSandbox(this, window);

    if (options.currentReadyState != "complete" &&
        window.document.readyState == "complete") {
      // If we attempted to attach the worker before the document was loaded but
      // it has now completed loading then the parent should reasonably expect
      // to see a pageshow event.
      this.sandbox.emitSync("pageshow");
      this.send("pageshow");
    }
  },
  // messages
  receive(id, args) {
    if (id !== this.id)
      return;
    this.sandbox.emit(...args);
    if (args[0] === 'detach')
      this.destroy(args[1]);
  },
  send(...args) {
    args = JSON.parse(JSON.stringify(args, exceptions));
    process.port.emit('sdk/worker/event', this.id, args);
  },
  // notifications
  observe({ type, subject }) {
    if (!this.sandbox)
      return;
    if (subject.defaultView && getInnerId(subject.defaultView) === this.window) {
      this.sandbox.emitSync(EVENTS[type]);
      this.send(EVENTS[type]);
    }
    if (type === 'inner-window-destroyed' &&
        subject.QueryInterface(Ci.nsISupportsPRUint64).data === this.window) {
      this.destroy();
    }
  },
  // detach/destroy: unload and release the sandbox
  destroy(reason) {
    if (!this.sandbox)
      return;
    process.port.off('sdk/worker/message', this.receive);
    this.sandbox.destroy(reason);
    this.sandbox = null;
    this.send('detach');
    keepAlive.delete(this.id);
  }
})
exports.WorkerChild = WorkerChild;

// Error instances JSON poorly
function exceptions(key, value) {
  if (!isObject(value) || !instanceOf(value, Error))
    return value;
  let _errorType = value.constructor.name;
  let { message, fileName, lineNumber, stack, name } = value;
  return { _errorType, message, fileName, lineNumber, stack, name };
}

// workers for windows in this tab
let keepAlive = new Map();

process.port.on('sdk/worker/create', (options) => {
  let window = getByInnerId(options.window);
  if (!window)
    return;

  process.port.emit('sdk/worker/attach', options.id);
  keepAlive.set(options.id, new WorkerChild(options));
})

when(reason => {
  for (let worker of keepAlive.values())
    worker.destroy(reason);
});
