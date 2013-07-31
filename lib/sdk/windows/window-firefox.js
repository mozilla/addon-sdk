/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

let views = new WeakMap();
let viewFor = window => views.get(window);
let instanceView = method(viewFor);

let WindowFields = {

}


let Window = Class({
  initialize: function(view) {
    views.set(this, view);
  },

});

getActiveView.define(Window, viewFor);
