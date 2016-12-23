/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";


const {Disposable} = require("sdk/core/disposable");
const {emit} = require("sdk/system/events");

class Jetpack extends Disposable {
  constructor() {
    this.initialize();
    emit("test-jetpack-construct", {data: "construct"});
  }
  dispose() {
    emit("test-jetpack-dispose", {data: "dispose"});
  }
};
exports.Jetpack = Jetpack;
