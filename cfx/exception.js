/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

// Set of custom exception class for cfx.js
// Designed to be handled nicely from main module

function cfxError(message, name) {
  let error = Error(message);
  error.cfxError = true;
  error.name = name;
  error.toString = function () {
    return this.name + ": "+ this.message;
  };
  return error;
}

exports.InvalidArgument = function InvalidArgument(message) {
  return cfxError(message, 'InvalidArgument')
}

exports.InternalCfxError = function InternalCfxError(message) {
  return cfxError(message, 'InternalCfxError')
}
