/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
"use strict";

const { ignoreWindow } = require("../private-browsing/utils");
const { complement, compose } = require("../lang/functional");
const { events } = require("./events");
const { emit } = require("../event/core");
const { modelFor } = require("../model/core");
const { BrowserWindow } = require("./model");
const { browserWindows } = require("./collection");
const { field } = require("../util/oops");
const { filter, map, spawn } = require("../event/utils");
const { reduce } = require("../util/sequence");
const { isPrivateBrowsingSupported } = require("../self");
const { browsers, getOuterId } = require("./utils");

let RENAMES = {
  // TODO: Pretending that window get's `open` on
  // `DOMContentLoaded` is nusty but it was already
  // a case. Maybe in a future we could use
  // `browser-delayed-startup-finished` instead.
  "DOMContentLoaded": "open"
};

// Skip events on targets that are not compatible with privacy
// constraints.
let isCompatible = complement(ignoreWindow);
let supported = filter(events, compose(isCompatible, field("target")));
let all = map(supported, ({type, target}) => ({ type: RENAMES[type] || type,
                                                target: target }));

// Function that will react to every window related event, creating new
// window models when new windows open & destroying them when associated
// windows are closed. It also emits all the events on the models.
let react = ({type, target}) => {
  // Either get model associated with a window or create new model if one
  // does not exists yet.
  let model = modelFor(target) || BrowserWindow({ id: getOuterId(target) });

  // Dispatch events on both model itself and a collection.
  emit(model, type, model);
  emit(browserWindows, type, model);

  // If it's a close event destroy model to release a reference.
  if (type === "close") model.destroy();
};

let main = () => {
  // Go through existing browser windows and create models for each one
  // to make them available through window iterator.
  reduce((_, view) => BrowserWindow({ id: getOuterId(view) }),
         null,
         browsers({ includePrivate: isPrivateBrowsingSupported }));

  // Spawn up a mutation loop that will react to every window related
  // event.
  spawn(react, all);
};
exports.main = main;
