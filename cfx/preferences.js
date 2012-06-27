/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const { Cc, Ci } = require("chrome");
const DOMSerializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].
                      createInstance(Ci.nsIDOMSerializer);
const DOMParser = Cc["@mozilla.org/xmlextras/domparser;1"].
                  createInstance(Ci.nsIDOMParser);

const { InvalidArgument } = require("./exception");

const VALID_PREF_TYPES = ['bool', 'boolint', 'integer', 'string', 'color',
                          'file', 'directory', 'control'];

// Validate preferences from `preferences`'s package.json attribute
function validate(options) {
  for (let key in options) {
    let pref = options[key];
    // Make sure there is a 'title'
    if (!("title" in pref))
      throw new InvalidArgument("The '" + pref.name + "' pref requires a 'title'");

    // Make sure that the pref type is a valid inline pref type
    if (VALID_PREF_TYPES.indexOf(pref.type) === -1)
      throw new InvalidArgument(pref.type + " is not a valid inline pref type");

    // Make sure the 'control' type has a 'label'
    if (pref.type == "control" && !("label" in pref))
      throw new InvalidArgument("The 'control' inline pref type requires a 'label'");

    // TODO: Check that pref["type"] matches default value type
  }
}
exports.validate = validate;

function createXULDocument(content) {
  let str = "<?xml version=\"1.0\"?>" + content;
  return DOMParser.parseFromString(str, "application/xml");
}

// Takes preferences`'s package.json attribute and returns the options.xul
// file content needed to build preference panel opened from about:addons
function generateOptionsXul(options, jetpackId) {
  let xulns = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
  let content = "<vbox xmlns=\"" + xulns + "\"></vbox>";
  let doc = createXULDocument(content);
  let root = doc.documentElement;

  for (let key in options) {
    let pref = options[key];
    let setting = doc.createElement("setting");
    setting.setAttribute("pref", "extensions." + jetpackId + "." + pref.name);
    setting.setAttribute("type", pref.type);
    setting.setAttribute("title", pref.title);

    if ("description" in pref)
      setting.appendChild(doc.createTextNode(pref.description));

    if (pref.type == "control") {
      button = doc.createElement("button");
      button.setAttribute("label", pref.label);
      button.setAttribute("oncommand", "Services.obs.notifyObservers(null, '" +
                                        jetpackId + "-cmdPressed', '" +
                                        pref.name + "');");
      setting.appendChild(button);
    }
    else if (pref.type == "boolint") {
      setting.setAttribute("on", pref.on);
      setting.setAttribute("off", pref.off);
    }
    root.appendChild(setting);
  }

  return DOMSerializer.serializeToString(root);
}
exports.generateOptionsXul = generateOptionsXul;

function isFloat(value) {
  return typeof(value) == "number" && value % 1 !== 0;
}

/**
 * Based on preferences manifest written in package.json file of an addon,
 * returns the necessary prefs.js file content. This file is going to set
 * default preference values when the addon will be installed.
 */
function generatePrefsJS(options, jetpackId) {
  let prefList = []

  for (let key in options) {
    let pref = options[key];
    if (!('value' in pref))
      continue;

    if (["boolean", "number", "string"].indexOf(typeof(pref.value)) === -1
        || isFloat(pref.value))
      throw new InvalidArgument("The '" + pref.name + "' pref has an " +
                                "unsupported type '"+ typeof(pref.value) +"'." +
                                " Supported types are: boolean, (non-float) " +
                                "number and string.");

    let prefKey = "extensions." + jetpackId + "." + pref.name;
    let prefValue = JSON.stringify(pref.value);
    prefList.push("pref(\"" + prefKey +"\", " + prefValue + ");");
  }

  return prefList.join("\n") + "\n";
}
exports.generatePrefsJS = generatePrefsJS;
