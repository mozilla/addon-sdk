/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { WindowTracker } = require("../deprecated/window-utils");
const { isBrowser, windows } = require('sdk/window/utils');
const { validateOptions } = require("../deprecated/api-utils");
const { Class } = require("../core/heritage");
const { ns } = require("../core/namespace");

const { xulNS } = require('./namespace');

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const VALID_POSITIONS = ['top'];

// Converts anything that isn't false, null or undefined into a string
function stringOrNull(val) val ? String(val) : val;

const XUL_SKELETON = Class({
  setup: function initialize(attributes) {
  	const internals = xulNS(this);
    internals.attributes = attributes;
  },
  appendChild: function appendChild(node) {
  	const ID = this.getAttribute('id');

  	// keep note to update parent in future windows
    xulNS(node).parentID = ID;

    // update parent on current windows
    windows().forEach(function(window) {
      let parent = window.document.getElementById(ID);
      let { element } = xulNS(node).windowsNS(window);
      parent.appendChild(element);
    });
  },
  addEventListener: function addEventListener(type, listener, useCapture) {
    internals.eles.forEach(function(ele) {
      ele.addEventListener(type, listener, useCapture);
    });
  },
  removeEventListener: function removeEventListener(type, listener, useCapture) {
    internals.eles.forEach(function(ele) {
      ele.removeEventListener(type, listener, useCapture);
    });
  },
  getAttribute: function getAttribute(attr) {
    return xulNS(this).attributes[attr];
  },
  setAttribute: function setAttribute(attr, value) {
  	const internals = xulNS(this);
    internals.eles.forEach(function(ele) {
      ele.setAttribute(attr, value);
      internals.attributes[attr] = value;
    });
  }
});

const XUL = Class({
  implements: [ XUL_SKELETON ],
  initialize: function(nodeName, attributes) {
  	const self = this;
  	const internals = xulNS(this);
    internals.windowsNS = ns();
    internals.eles = [];
    internals.attributes = attributes;

    XUL_SKELETON.prototype.setup.call(this, attributes);

    // Set Window Tracker
    internals.windowtracker = WindowTracker({
      onTrack: function(window) {
        if (!isBrowser(window)) return;
        let ele = window.document.createElementNS(NS_XUL, nodeName);
        ele.setAttribute('id', attributes.id);
        internals.eles.push(ele);
        internals.windowsNS(window).element = ele;

        // update parent?
        if (internals.parentID) {
          let parent = window.document.getElementById(internals.parentID);
          parent.appendChild(ele);
        }
      },
      onUntrack: function(window) {
        if (!isBrowser(window)) return;
        let { element } = internals.windowsNS(window);
        element.parentNode.removeChild(element);
        internals.windowsNS(window).element = null;
      }
    });
  },
  destroy: function() {
    const internals = xulNS(this);
    internals.windowtracker.unload();
    internals.windowtracker = null;
    internals.windowsNS = null;
  }
});
exports.XUL = XUL;

function getXULById(id) {
  let xul = XUL_SKELETON();
  xul.setup({ id: id });
  return xul;
}
exports.getXULById = getXULById;
