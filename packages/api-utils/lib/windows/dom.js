/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

module.metadata = {
  "stability": "unstable"
};

const { Trait } = require('../traits'),
      { getMode } = require('api-utils/private-browsing/utils');

const WindowDom = Trait.compose({
  _window: Trait.required,
  get title() {
    let window = this._window;
    return window && window.document ? window.document.title : null
  },
  close: function close() {
    let window = this._window;
    if (window) window.close();
    return this._public;
  },
  activate: function activate() {
    let window = this._window;
    if (window) window.focus();
    return this._public;
  },
  get isPrivateBrowsing() {
    return getMode(this._window);
  }
});
exports.WindowDom = WindowDom;
