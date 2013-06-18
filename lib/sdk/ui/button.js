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
const { Class } = require('../core/heritage');
const { merge } = require('../util/object');
const { properties } = require("./component");
const { Disposable } = require('../core/disposable');
const { contract } = require('../util/contract');
const { on, off, emit, setListeners } = require('../event/core');
const { EventTarget } = require('../event/target');
const  events = require("../event/utils");

const { isNil, isObject } = require('../lang/type');
const { required } = require('../deprecated/api-utils');
const { URL } = require('../url');

const { add, remove, has, clear, iterator } = require("../lang/weak-set");

const tabs = require("../tabs");
const { browserWindows } = require("sdk/windows");

const view = require("./button/view");

const { data } = require("../self");

function isLocalURL(url) {
  try {
    return ['resource', 'data'].indexOf(URL(url).scheme) > -1;
  }
  catch(e) {}

  return false;
}

let string = { is: ['string', 'undefined', 'null']};
let number = { is: ['number', 'undefined', 'null'] };
let boolean = { is: ['boolean', 'undefined', 'null'] };

let image = {
  is: string.is,
  map: function (v) isNil(v) ? v : ~String.indexOf(v, "./") ? data.url(v.substr(2)) : v,
  ok: isLocalURL,
  msg: 'The option "image" must be a local URL'
};

let buttonId = { is: string.is, ok: function (v) /^[a-z0-9-_]+$/i.test(v),
  msg: 'The option "id" must be a valid alphanumeric id (hyphens and ' +
        'underscores are allowed).'
};

let buttonType = {
  is: string.is,
  ok: function (v) isNil(v) || ~['button', 'checkbox'].indexOf(v),
  msg: 'The option "type" must be one of the following string values: ' +
    '"button", "checkbox".'
}

let size = {
  is: string.is,
  ok: function (v) isNil(v) || ~['small', 'medium', 'large'].indexOf(v),
  msg: 'The option "size" must be one of the following string values: ' +
    '"small", "medium", "large".'
};

let buttonContract = contract({
  id: required(buttonId),
  label: required(string),
  image: required(image),
  type: buttonType,
  disabled: boolean,
  checked: boolean,
  size: size
})

const Button = Class({
  extends: EventTarget,
  implements: [
    properties(buttonContract),
    EventTarget,
    Disposable
  ],
  setup: function setup(options) {
    let state = merge({
      type: 'button',
      disabled: false,
      checked: false,
      size: 'small',
    }, buttonContract(options));

    // Setup listeners.
    setListeners(this, options);

    // TODO: improve
    let viewEvents = view.create(state);

    on(viewEvents, 'click', function() {
      let state = this.state(tabs.activeTab);

      if (options.type === 'checkbox') {
        state = ({}, state, { checked: !state.checked });

        this.state(browserWindows.activeWindow, state);

        emit(this, 'change', state);
      }

      emit(this, 'click', state);
    }.bind(this));

    // Set the default state
    this.state(this, state);
  },

  dispose: function dispose() {
    off(this);

    view.dispose(this);
  },

  get id() this.state().id,
  get size() this.state().size,

  click: function click() {
    view.click(this);
  }
});
exports.Button = Button;

on(Button, 'render', function(button, window, state) {
  view.setImage(button, window, state.image);
  view.setLabel(button, window, state.label);
  view.setDisabled(button, window, state.disabled);
  view.setChecked(button, window, state.checked);
});

