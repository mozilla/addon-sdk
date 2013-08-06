/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Class } = require('../core/heritage');
const { EventTarget } = require('../event/target');
const { off, emit, setListeners } = require('../event/core');
const { ns } = require('../core/namespace');
const { Disposable } = require('../core/disposable');

const internalsNS = ns();

const AttributeObserver = Class({
  implements: [ Disposable ],
  extends: EventTarget,
  setup: function(options) {
    const self = this;
    const internals = internalsNS(this);
    let { target } = options;
    let window = target.ownerDocument.defaultView;

    setListeners(this, options);

    let obs = new window.MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        emit(self, mutation.attributeName);
      });
    });
    internals.observer = obs;

    obs.observe(target, { attributes: true });
  },
  dispose: function() {
    const internals = internalsNS(this);

    off(this);

    if (internals.observer) {
      internals.observer.disconnect();
      internals.observer = null;
    }
  }
});
exports.AttributeObserver = AttributeObserver;
