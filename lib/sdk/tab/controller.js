/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { events } = require("./events");
const { Tab } = require("./model");
const { getTabId, getTabs, getOwnerWindow } = require("./utils");
const { tabs } = require("./collection");
const { ignoreWindow } = require("../private-browsing/utils");
const { filter, map, spawn } = require("../event/utils");
const { complement, compose, field } = require("../lang/functional");
const { reduce } = require("../util/sequence");

let RENAMES = {
  "TabOpen": "open",
  "TabClose": "close",
  "TabSelect": "activate",
  "TabMove": "move",
  "TabPinned": "pin",
  "TabUnpinned": "unpin"
};

// Composed function return `true` if given window is compatible with
// privacy constraints. Composition will return `!ignoreWindow(window)`.
let isCompatible = complement(ignoreWindow);
// Composed function returs `true` if tab is compatible with privacy
// constraints. Composition will return: `!ignoreWindow(getOwnerWindow(tab))`
let isTabCompatible = compose(isCompatible, getOwnerWindow);
// Filter out tab events to only once that are compatible with a privacy
// constraints. Composed predicate will return `!ignoreWindow(getOwnerWindow(event.target))`.
let supported = filter(events, compose(isCompatible, field("target")));
// Translate all tab events names to ones expected by a high level APIs. Mapping
// is provided by `RENAMES` hash.
let all = map(supported, ({type, target}) => ({ type: RENAMES[type] || type,
                                                target: target }));


// Function that will react to every tab related event, creating new
// tab models when tab is open & destroying them when associated
// tabs are closed. It also emits all the events on the models.
let react = ({type, target}) => {
  // Either get model associated with a tab or create new tab model
  // if one does not exists yet.
  let model = modelFor(target) || Tab({ id: getTabId(target) });

  // Dispatch events on both model itself and a collection.
  emit(model, type, model);
  emit(tabs, type, model);

  // If it's a close event destroy model to release a reference.
  if (type === "close") model.destroy();
};

// Main function just wraps mutation loop so that it can be triggered
// by user on demand rather on module load time.
let main = () => {
  // Go through existing tabs and create models for each one
  // to make them available through tab iterator.
  reduce((_, view) => Tab({ id: getTabId(view) }),
         null,
         getTabs());

  // Spawn up a mutation loop that will react to every window related
  // event.
  spawn(react, all);
};
exports.main = main;
