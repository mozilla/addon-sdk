/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Cu } = require("chrome");
const { Class } = require("../sdk/core/heritage");
const { EventTarget } = require("../sdk/event/target");
const { Disposable, setup, dispose } = require("../sdk/core/disposable");
const { contract, validate } = require("../sdk/util/contract");
const { id: addonID } = require("../sdk/self");
const { onEnable, onDisable } = require("dev/theme/hooks");
const { Style } = require("sdk/stylesheet/style");

const makeID = name =>
  ("dev-theme-" + addonID + "-" + name).
  split("/").join("-").
  split(".").join("-").
  split(" ").join("-").
  replace(/[^A-Za-z0-9_\-]/g, "");

const Theme = Class({
  extends: Disposable,
  implements: [EventTarget],
  get id() {
    return makeID(this.name || this.label);
  },
  setup: function() {
  }
});

exports.Theme = Theme;

// Initialization & dispose

setup.define(Theme, (theme) => {
  theme.classList = [];
  theme.setup();
});

dispose.define(Theme, function(theme) {
  theme.dispose();
});

// Validation

validate.define(Theme, contract({
  label: {
    is: ["string"],
    msg: "The `option.label` must be a provided"
  },
}));

// Support for standard object method override (to handle theme events).

onEnable.define(Theme, (theme, {window, oldTheme}) => {
  theme.onEnable(window, oldTheme);
});

onDisable.define(Theme, (theme, {window, newTheme}) => {
  theme.onDisable(window, newTheme);
});

// Support for built-in themes

const lightStyleUri = "chrome://browser/skin/devtools/light-theme.css";
const darkStyleUri = "chrome://browser/skin/devtools/dark-theme.css";

const LightTheme = Class({
  extends: Theme,
  setup: function() {
    this.styles = Style({uri: [lightStyleUri].concat(this.styles.uri)});
    this.classList.push("theme-light");
  }
});

const DarkTheme = Class({
  extends: Theme,
  setup: function() {
    this.styles.uri.unshift("chrome://browser/skin/devtools/dark-theme.css");
    this.classList.push("theme-dark");
  }
});

exports.LightTheme = LightTheme;
exports.DarkTheme = DarkTheme;
