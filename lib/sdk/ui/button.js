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
const { Component, properties } = require("./component");
const { Disposable } = require('../core/disposable');
const { contract } = require('../util/contract');
const { on, off, emit, setListeners } = require('../event/core');
const { EventTarget } = require('../event/target');
const systemEvents = require('../system/events');
const  events = require("../event/utils");

const { isNil, isObject } = require('../lang/type');
const { required } = require('../deprecated/api-utils');
const { URL } = require('../url');

const domButton = require("./button/utils");
const { add, remove, has, clear, iterator } = require("../lang/weak-set");

const { union } = require("../util/array");

//let assetsURI = require("./self").data.url();

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

let text = union(string.is, number.is);

let localURI = { is: string.is, ok: isLocalURL,
  msg: 'The option "image" must be a local URL'
};

let buttontype = {
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

let badgeContract = contract({
  text: text,
  color: string
});

let badge = {
  is: ['object', 'undefined', 'null'],
  map: function(v) isNil(v) || !isObject(v) ? v : badgeContract(v)
}

let buttonContract = contract({
  id: required(string),
  label: required(string),
  image: required(localURI),
  type: buttontype,
  disabled: boolean,
  size: size,
  badge: badge
})

let buttons = {};
let views = new WeakMap();

function viewsFor(button) views.get(button);
function modelFor(button) models.get(button);

const Badge = Class({
  initialize: function initialize(button) {
    Object.defineProperty(this, 'button', {
      value: button
    });

    return Object.freeze(this);
  },
  get text() modelFor(this.button).badge.text,
  set text(value) {
    let model = modelFor(this.button);
    model.badge.text = badgeContract({text: value}).text;

    let { text, color } = model.badge;
    domButton.setBadge(viewsFor(this.button), text, color);
  },
  get color() modelFor(this.button).badge.color,
  set color(value) {
    let model = modelFor(this.button);
    model.badge.color = badgeContract({color: value}).color;

    let { text, color } = model.badge;
    domButton.setBadge(viewsFor(this.button), text, color);
  }
});

const Button = Class({
  implements: [
    // Generate accessors for the validated properties that update model on
    // set and return values from model on get.
    buttonContract.properties(modelFor),
    EventTarget,
    Disposable
  ],
//  extends: WorkerHost(workerFor),
  setup: function setup(options) {
    let model = merge({
      type: 'button',
      disabled: false,
      size: 'small',
      badge: {
        text: "",
        color: "#697077"
      }
    }, buttonContract(options));
    models.set(this, model);

    Object.defineProperty(this, "badge", { value: Badge(this) });

    // Setup listeners.
    setListeners(this, options);

    // Setup view
    let buttonViews = domButton.make(model.id);

    // buttonViews.forEach(function(view) add(buttons.set(view, this), this);

    views.set(this, buttonViews);

    domButton.setType(buttonViews, model.type);
    domButton.setImage(buttonViews, model.image);
    domButton.setLabel(buttonViews, model.label);
    domButton.setSize(buttonViews, model.size);
    domButton.setDisabled(buttonViews, model.disabled);
    domButton.setBadge(buttonViews, model.badge.text, model.badge.color);

    // TODO: improve
    buttonViews.forEach(function(view) {
      view.addEventListener("command", function() {
        let button = this;
        let model = modelFor(button);

        if (model.checked !== view.checked) {
          model.checked = view.checked;
          viewsFor(button).forEach(function(view) view.checked = model.checked);
          emit(button, "change");
        }

        emit(button, "click")
      }.bind(this));
    }, this);

    add(buttons, this)
  },
  dispose: function dispose() {
    off(this);

    domButton.dispose(viewsFor(this));

    // Release circular reference between view and button instance. This
    // way view will be GC-ed. And button as well once all the other refs
    // will be removed from it.
    views.delete(this);
  },

  get id() modelFor(this).id,

  get label() modelFor(this).label,
  set label(value) {
    let model = modelFor(this);
    model.label = buttonContract({label: value}).label;

    domButton.setLabel(viewsFor(this), model.label);
  },

  get image() modelFor(this).image,
  set image(value) {
    let model = modelFor(this);
    model.image = buttonContract({image: value}).image;

    domButton.setImage(viewsFor(this), model.image);
  },

  get type() modelFor(this).type,

  get disabled() modelFor(this).disabled,
  set disabled(value) {
    let model = modelFor(this);
    model.disabled = buttonContract.onlyFor({disabled: value}).disabled;

    domButton.setDisabled(viewsFor(this), model.disabled);
  },

  get size() modelFor(this).size,

  click: function click() {
    let views = viewsFor(this);

    domButton.click(views);
  }
});
exports.Button = Button;

const { events: browserEvents } = require("../browser/events");

let windowOpen = events.filter(browserEvents, function(e) e.type === "load");
let windowClose = events.filter(browserEvents, function(e) e.type === "close");

on(windowOpen, "data", function({target: window}){
  iterator(buttons).forEach(function(button) {
    viewsFor(button).push()
  })
});

on(windowClose, "data", function({target: window}){

});
