/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { validateOptions } = require("../deprecated/api-utils");
const { Class } = require("../core/heritage");
const { ns } = require("../core/namespace");
const { XUL, getXULById } = require('../xul/browser');

const toolbarNS = ns();

const Toolbar = Class({
  initialize: function initialize(options) {
  	const internals = toolbarNS(this);

    internals.xul = XUL('toolbar', {
      id: options.id,
      fullscreentoolbar: 'true'
    });

    getXULById('navigator-toolbox').appendChild(internals.xul);
  },
  appendChild: function appendChild(thing) {
    toolbarNS(this).xul.appendChild(thing);
  },
  show: function show() {
    toolbarNS(this).xul.setAttribute('collapsed', 'false');
  },
  hide: function hide() {
    toolbarNS(this).xul.setAttribute('collapsed', 'true');
  },
  destroy: function destroy() {
    const internals = toolbarNS(this);
    internals.xul.destroy();
    internals.xul = null;
  }
});
exports.Toolbar = Toolbar;
