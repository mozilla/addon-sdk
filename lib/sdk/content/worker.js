/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { emit } = require('../event/core');
const { Class } = require('../core/heritage');
const { method } = require('../lang/functional');
const { getInnerId } = require('../window/utils');
const { EventTarget } = require('../event/target');
const { when, ensure } = require('../system/unload');
const { getTabForWindow } = require('../tabs/helpers');
const { isPrivate } = require('../private-browsing/utils');
const { attach, detach, destroy } = require('./utils');
const { WorkerChild } = require('./worker-child');
const { Ci, Cc } = require('chrome');

const workers = new WeakMap();
let modelFor = (worker) => workers.get(worker);

const ERR_DESTROYED = "Couldn't find the worker to receive this message. " +
  "The script may not be initialized yet, or may already have been unloaded.";

const ERR_FROZEN = "The page is currently hidden and can no longer be used " +
                   "until it is visible again.";

// a handle for communicatin between content script and addon code
const Worker = Class({
  implements: [EventTarget],
  initialize(options = {}) {

    let model = {
      inited: false,
      earlyEvents: [],        // fired before worker was inited
      frozen: true,           // document is in BFcache, let it go
      options,
    };
    workers.set(this, model);

    ensure(this, 'destroy');
    this.on('detach', this.detach);
    EventTarget.prototype.initialize.call(this, options);

    this.receive = this.receive.bind(this);
    ppmm.addMessageListener('sdk/worker/event', this.receive);

    this.port = EventTarget();
    this.port.emit = this.send.bind(this, 'event');
    this.postMessage = this.send.bind(this, 'message');

    if ('window' in options)
      attach(this, options.window);
  },
  // messages
  receive({ data: { id, args }}) {
    let model = modelFor(this);
    if (id !== model.id || !model.childWorker)
      return;
    if (args[0] === 'event')
      emit(this.port, ...args.slice(1))
    else
      emit(this, ...args);
  },
  send(...args) {
    let model = modelFor(this);
    if (!model.inited) {
      model.earlyEvents.push(args);
      return;
    }
    if (!model.childWorker && args[0] !== 'detach')
      throw new Error(ERR_DESTROYED);
    if (model.frozen && args[0] !== 'detach')
      throw new Error(ERR_FROZEN);
    ppmm.broadcastAsyncMessage('sdk/worker/message', { id: model.id, args });
  },
  // properties
  get url() {
    let { window } = modelFor(this);
    return window && window.document.location.href;
  },
  get contentURL() {
    let { window } = modelFor(this);
    return window && window.document.URL;
  },
  get tab() {
    let { window } = modelFor(this);
    return window && getTabForWindow(window);
  },
  // methods
  attach: method(attach),
  detach: method(detach),
  destroy: method(destroy),
  // remove
  getSandbox() keepAlive[modelFor(this).id].sandbox,
  toString() '[object Worker]'
})
exports.Worker = Worker;

attach.define(Worker, function(worker, window) {
  let model = modelFor(worker);

  model.window = window;
  model.options.window = getInnerId(window);
  model.id = model.options.id = Math.random()*9999 | 0; // uuid()

  ppmm.addMessageListener('sdk/worker/attach', attach);
  ppmm.broadcastAsyncMessage('sdk/worker/create', model.options );

  function attach({ data: options }) {
    if (options.id !== model.id)
      return;
    ppmm.removeMessageListener('sdk/worker/attach', attach);
    options.messageManager = cpmm;
    model.childWorker = true;
    keepAlive[model.id] = WorkerChild(options);

    worker.on('pageshow', () => model.frozen = false);
    worker.on('pagehide', () => model.frozen = true);

    model.inited = true;
    model.frozen = false;

    model.earlyEvents.forEach(args => worker.send(...args));
    emit(worker, 'attach', window);
  }
})

// unload and release the child worker, release window reference
detach.define(Worker, function(worker, reason) {
  let model = modelFor(worker);
  worker.send('detach', reason);
  if (!model.childWorker)
    return;

  model.childWorker = null;
  model.earlyEvents = [];
  model.window = null;
  emit(worker, 'detach');
})

isPrivate.define(Worker, ({ tab }) => isPrivate(tab));

// unlod worker, release references
destroy.define(Worker, function(worker, reason) {
  detach(worker, reason);
  modelFor(worker).inited = true;
  ppmm.removeMessageListener('sdk/worker/event', this.receive);
})

const keepAlive = {};

const ppmm = Cc['@mozilla.org/parentprocessmessagemanager;1'].
  getService(Ci.nsIMessageBroadcaster);

const cpmm = Cc['@mozilla.org/childprocessmessagemanager;1'].
  getService(Ci.nsISyncMessageSender);

cpmm.addMessageListener('sdk/worker/create', create);
cpmm.addMessageListener('sdk/worker/event', release);

when(_ => cpmm.removeMessageListener('sdk/worker/create', create));
when(_ => cpmm.removeMessageListener('sdk/worker/event', release));

function create({ data }) {
  cpmm.sendAsyncMessage('sdk/worker/attach', data);
}

function release({ data: { id, args: [event] }}) {
  if (event === 'detach')
    delete keepAlive[id];
}
