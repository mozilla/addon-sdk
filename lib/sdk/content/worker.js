/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Class } = require('../core/heritage');
const { ensure } = require('../system/unload');
const { method } = require('../lang/functional');
const { EventTarget } = require('../event/target');
const { getTabForWindow } = require('../tabs/helpers');
const { isPrivate } = require('../private-browsing/utils');
const { attach, detach, destroy } = require('./utils');
const { WorkerChild } = require('./worker-child');

const workers = new WeakMap();
let modelFor = (worker) => workers.get(worker);

const ERR_DESTROYED = "Couldn't find the worker to receive this message. " +
  "The script may not be initialized yet, or may already have been unloaded.";

const ERR_FROZEN = "The page is currently hidden and can no longer be used " +
                   "until it is visible again.";

// a handle for communicatin between content script and addon code
const Worker = Class({
  implements: [EventTarget],
  initialize: function WorkerConstructor(options = {}) {

    let model = {
      inited: false,
      window: null,           // attached to window
      childWorker: null,      // ref to child worker
      earlyEvents: [],        // fired before worker was inited
      frozen: true,           // document is in BFcache, let it go
      options,
    };
    workers.set(this, model);

    ensure(this, 'destroy');
    this.on('detach', this.detach);
    EventTarget.prototype.initialize.call(this, options);

    this.port = EventTarget();
    this.port.emit = this.emit.bind(this, 'event');
    this.postMessage = this.emit.bind(this, 'message');

    if ('window' in options)
      attach(this, options.window);
  },

  emit(...args) {
    let model = modelFor(this);
    if (!model.inited) {
      model.earlyEvents.push(args);
      return;
    }
    if (!model.childWorker)
      throw new Error(ERR_DESTROYED);
    if (model.frozen)
      throw new Error(ERR_FROZEN);
    model.childWorker.sandbox.emit(...args);
  },

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

  // to be removed..
  getSandbox() {
    return modelFor(this).childWorker.sandbox;
  },

  toString: () => '[object Worker]',
  attach: method(attach),
  detach: method(detach),
  destroy: method(destroy)
})
exports.Worker = Worker;

attach.define(Worker, function(worker, window) {
  let model = modelFor(worker);
  model.window = window;
  model.options.window = null;
  
  model.childWorker = WorkerChild(model.options, model.window, worker);

  worker.on('pageshow', () => model.frozen = false);
  worker.on('pagehide', () => model.frozen = true);

  model.frozen = false;
  model.inited = true;

  model.earlyEvents.forEach(args => worker.emit(...args));
})

// unload and release the child worker, release references to the document
detach.define(Worker, function(worker, reason) {
  let model = modelFor(worker);
  if (!model.childWorker)
    return;
  model.childWorker.destroy(reason);
  model.childWorker = null;
  model.earlyEvents = [];
  model.window = null;
})

isPrivate.define(Worker, ({ tab }) => isPrivate(tab));

// unlod content worker, release references
destroy.define(Worker, function(worker, reason) {
  detach(worker, reason);
  modelFor(worker).inited = true;
  worker.port.off();
  worker.off();
})
