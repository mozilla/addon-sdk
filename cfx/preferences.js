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
                          'file', 'directory', 'control', 'menulist', 'radio'];

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

    if (pref.type == "menulist" || pref.type == "radio") {
      // Make sure 'menulist' and 'radio' types have a 'options'
      if (!("options" in pref))
        throw new InvalidArgument("The 'menulist' and the 'radio' inline pref" +
                                  " types requires a 'options'");
      // Make sure each option has a 'value' and a 'label'
      pref.options.forEach(function (item) {
        if (!("value" in item))
          throw new InvalidArgument("'options' requires a 'value'");
        if (!("label" in item))
          throw new InvalidArgument("'options' requires a 'label'");
      });
    }

    // TODO: Bug 772126: Check that pref["type"] matches default value type
  }
}
exports.validate = validate;

// Takes preferences`'s package.json attribute and returns the options.xul
// file content needed to build preference panel opened from about:addons
function generateOptionsXul(options, jetpackId) {
  // Bug 773259: Unfortunately, parseFromString/serializeToString are throwing
  // various exceptions when using XUL documents. So that we can only serialize
  // <setting> nodes as pure XML nodes.
  let xmlString =
    "<?xml version=\"1.0\" ?>\n" +
    "<vbox xmlns=\"http://www.mozilla.org/keymaster/gatekeeper/" +
                  "there.is.only.xul\">\n";

  // Create a document, just to be able to create <setting> DOM nodes
  let doc = DOMParser.parseFromString("<?xml version=\"1.0\" ?><root />",
                                      "application/xml");

  for (let key in options) {
    let pref = options[key];
    let setting = doc.createElement("setting");
    setting.setAttribute("pref-name", pref.name);
    setting.setAttribute("data-jetpack-id", jetpackId);
    setting.setAttribute("pref", "extensions." + jetpackId + "." + pref.name);
    setting.setAttribute("title", pref.title);
    setting.setAttribute("type", pref.type);

    if ("description" in pref)
      setting.appendChild(doc.createTextNode(pref.description));

    if (pref.type == "control") {
      button = doc.createElement("button");
      button.setAttribute("pref-name", pref.name);
      button.setAttribute("data-jetpack-id", jetpackId);
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
    else if (pref.type == "menulist") {
      let menulist = doc.createElement("menulist");
      let menupopup = doc.createElement("menupopup");
      pref.options.forEach(function (item) {
        let menuitem = doc.createElement("menuitem");
        menuitem.setAttribute("value", item.value);
        menuitem.setAttribute("label", item.label);
        menupopup.appendChild(menuitem);
      });
      menulist.appendChild(menupopup);
      setting.appendChild(menulist);
    }
    else if (pref.type == "radio") {
      let radiogroup = doc.createElement("radiogroup");
      pref.options.forEach(function (item) {
        let radio = doc.createElement("radio");
        radio.setAttribute("value", item.value);
        radio.setAttribute("label", item.label);
        radiogroup.appendChild(radio);
      });
      setting.appendChild(radiogroup);
    }

    xmlString += "  " + DOMSerializer.serializeToString(setting) + "\n";
  }

  xmlString += "</vbox>\n";

  return xmlString;
}
exports.generateOptionsXul = generateOptionsXul;

function isFloat(value) {
  return typeof(value) == "number" && value % 1 !== 0;
}
function isPrimitive(value) {
  return ["boolean", "number", "string"].indexOf(typeof(value)) === -1;
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

    if (isPrimitive(pref.value) || isFloat(pref.value))
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
