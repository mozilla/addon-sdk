/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'unstable'
};

const { method } = require('method/core');

const { windowNS, rawWindowNS } = require('./namespace');

const getDOMWindow = exports.getDOMWindow = method('getDOMWindow');
getDOMWindow.define(function getDOMWindow(window) {
  let internals = windowNS(window);
  return (internals && internals.window) || null;
});

const getSDKWindow = exports.getSDKWindow = method('getSDKWindow');
getSDKWindow.define(function getSDKWindow(window) {
  let internals = rawWindowNS(window);
  return (internals && internals.window) || null;
});
