/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

// The Button module currently supports only Firefox.
// See: https://bugzilla.mozilla.org/show_bug.cgi?id=jetpack-panel-apps
module.metadata = {
  'stability': 'stable',
  'engines': {
    'Firefox': '*'
  }
};

const { Ci } = require('chrome');
const { Class } = require('../core/heritage');
const { merge } = require('../util/object');
const { Disposable } = require('../core/disposable');
const { on, off, emit, setListeners } = require('../event/core');
const { EventTarget } = require('../event/target');
const systemEvents = require('../system/events');
const { open } = require("../event/dom");
const events = require("../event/utils");
const { isNil, isObject } = require('../lang/type');
const { required } = require('../deprecated/api-utils');
const { URL } = require('../url');
const { add, remove, has, clear, iterator } = require("../lang/weak-set");
const { getMostRecentBrowserWindow } = require("../window/utils");
const { make, dispose } = require('./sidebar/utils');

let string = { is: ['string']};

let contract = require('../util/contract').contract({
  id: required(string),
  label: required(string),
  url: required(string)
});

let sidebars = {};
let models = new WeakMap();
let views = new WeakMap();

function viewsFor(button) views.get(button);
function modelFor(button) models.get(button);

const Sidebar = Class({
  implements: [ Disposable ],
  extends: EventTarget,
  setup: function(options) {
    let model = merge({}, contract(options));

    models.set(this, model);

    let bars = make({
      id: model.id,
      label: model.label,
      sidebarurl: model.url,
      type: 'content'
    });

    views.set(this, bars);

    add(sidebars, this);
  },
  get id() modelFor(this).id,
  show: function() {
  	// TODO: ignore pb windows
  	getMostRecentBrowserWindow().toggleSidebar(this.id);
  },
  dispose: function() {
    off(this);
    viewsFor(this).forEach(function(view) {
      dispose(view);
    });

    remove(sidebars, this);

    views.delete(this);
  }
});
exports.Sidebar = Sidebar;
