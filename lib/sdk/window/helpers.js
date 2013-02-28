/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { defer } = require('../core/promise');
const { open: openWindow, onFocus } = require('./utils');

function open(uri, options) {
  let deferred = defer();
  let window = openWindow.apply(null, arguments);
  once(window, 'load').then(deferred.resolve);
  return deferred.promise;
}
exports.open = open;

function close(window) {
  let deferred = defer();
  once(window, 'unload').then(deferred.resolve);
  window.close();
  return deferred.promise;
}
exports.close = close;

function focus(window) {
  let deferred = defer();
  onFocus(window).then(deferred.resolve);
  window.focus();
  return deferred.promise;
}
exports.focus = focus;

function once(window, evt) {
  let deferred = defer();

  window.addEventListener(evt, function eventHandler() {
    window.removeEventListener(evt, eventHandler, false);
    deferred.resolve(window);
  }, false);

  return deferred.promise;
}
exports.once = once;