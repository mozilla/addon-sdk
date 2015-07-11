/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  "stability": "unstable"
};

const { Cc, Ci, Cu } = require('chrome');
const { on } = require('../system/events');
const { id, preferencesBranch } = require('../self');
const { localizeInlineOptions } = require('../l10n/prefs');
const { AddonManager } = Cu.import("resource://gre/modules/AddonManager.jsm");
const { defer } = require("sdk/core/promise");

const DEFAULT_OPTIONS_URL = 'data:text/xml,<placeholder/>';

const VALID_PREF_TYPES = ['bool', 'boolint', 'integer', 'string', 'color',
                          'file', 'directory', 'control', 'menulist', 'radio', 'hotkey'];

function enable({ preferences, id }) {
  let enabled = defer();

  validate(preferences);

  setDefaults(preferences, preferencesBranch);

  // allow the use of custom options.xul
  AddonManager.getAddonByID(id, (addon) => {
    on('addon-options-displayed', onAddonOptionsDisplayed, true);
    enabled.resolve({ id: id });
  });

  function onAddonOptionsDisplayed({ subject: doc, data }) {
    if (data === id) {
      let parent = doc.getElementById('detail-downloads').parentNode;
      injectOptions({
        preferences: preferences,
        preferencesBranch: preferencesBranch,
        document: doc,
        parent: parent,
        id: id
      });
      localizeInlineOptions(doc);
    }
  }

  return enabled.promise;
}
exports.enable = enable;

// centralized sanity checks
function validate(preferences) {
  for (let { name, title, type, label, options } of preferences) {
    // make sure the title is set and non-empty
    if (!title)
      throw Error("The '" + name + "' pref requires a title");

    // make sure that pref type is a valid inline option type
    if (!~VALID_PREF_TYPES.indexOf(type))
      throw Error("The '" + name + "' pref must be of valid type");

    // if it's a control, make sure it has a label
    if (type === 'control' && !label)
      throw Error("The '" + name + "' control requires a label");

    // if it's a menulist or radio, make sure it has options
    if (type === 'menulist' || type === 'radio') {
      if (!options)
        throw Error("The '" + name + "' pref requires options");

      // make sure each option has a value and a label
      for (let item of options) {
        if (!('value' in item) || !('label' in item))
          throw Error("Each option requires both a value and a label");
      }
    }
    if (type === 'hotkey') {
      // Todo: Check exact format expected for hotkeys (put it as method of KeySelector.validate(str)!)
    }

    // TODO: check that pref type matches default value type
  }
}
exports.validate = validate;

// initializes default preferences, emulates defaults/prefs.js
function setDefaults(preferences, preferencesBranch) {
  const branch = Cc['@mozilla.org/preferences-service;1'].
                 getService(Ci.nsIPrefService).
                 getDefaultBranch('extensions.' + preferencesBranch + '.');
  for (let { name, value } of preferences) {
    switch (typeof value) {
      case 'boolean':
        branch.setBoolPref(name, value);
        break;
      case 'number':
        // must be integer, ignore otherwise
        if (value % 1 === 0) {
          branch.setIntPref(name, value);
        }
        break;
      case 'string':
        let str = Cc["@mozilla.org/supports-string;1"].
                  createInstance(Ci.nsISupportsString);
        str.data = value;
        branch.setComplexValue(name, Ci.nsISupportsString, str);
        break;
    }
  }
}
exports.setDefaults = setDefaults;

// dynamically injects inline options into about:addons page at runtime
function injectOptions({ preferences, preferencesBranch, document, parent, id }) {
  const branch = Cc['@mozilla.org/preferences-service;1'].
                 getService(Ci.nsIPrefService).
                 getBranch('extensions.' + preferencesBranch + '.');

  for (let { name, type, hidden, title, description, label, options, on, off } of preferences) {

    if (hidden) {
      continue;
    }

    let setting = document.createElement('setting');
    setting.setAttribute('pref-name', name);
    setting.setAttribute('data-jetpack-id', id);
    setting.setAttribute('pref', 'extensions.' + preferencesBranch + '.' + name);
    setting.setAttribute('type', type === 'hotkey' ? 'string' : type);
    setting.setAttribute('title', title);
    if (description)
      setting.setAttribute('desc', description);

    if (type === 'file' || type === 'directory') {
      setting.setAttribute('fullpath', 'true');
    }
    else if (type === 'control') {
      let button = document.createElement('button');
      button.setAttribute('pref-name', name);
      button.setAttribute('data-jetpack-id', id);
      button.setAttribute('label', label);
      button.setAttribute('oncommand', "Services.obs.notifyObservers(null, '" +
                                        id + "-cmdPressed', '" + name + "');");
      setting.appendChild(button);
    }
    else if (type === 'boolint') {
      setting.setAttribute('on', on);
      setting.setAttribute('off', off);
    }
    else if (type === 'menulist') {
      let menulist = document.createElement('menulist');
      let menupopup = document.createElement('menupopup');
      for (let { value, label } of options) {
        let menuitem = document.createElement('menuitem');
        menuitem.setAttribute('value', value);
        menuitem.setAttribute('label', label);
        menupopup.appendChild(menuitem);
      }
      menulist.appendChild(menupopup);
      setting.appendChild(menulist);
    }
    else if (type === 'hotkey') {
      // Todo: Better way to import and inject this code?
      var keySelectorCode = `var KeySelector = (function () {'use strict';
            var winOn = false;
            function keydown (e) {
                var target = e.target,
                    str = '';
                target.value = '';
                if (e.shiftKey)  {
                    str += 'shift';
                }
                if (e.ctrlKey) {
                    str += (str ? '+' : '') + 'ctrl';
                }
                if (e.altKey)  {
                    str += (str ? '+' : '') + 'alt';
                }
                if (e.keyCode === 91) { // Win key
                    winOn = (str ? (str + '+') : '') + 'win';
                }
                else {
                    target.value = str;
                }
            }
            function keypress (e) {
                var target = e.target;
                target.value += (target.value ? '+' : '') + String.fromCharCode(e.charCode);
                e.preventDefault();
            }
            function keyup (e) {
                if (e.keyCode === 91) { // Win key
                    return;
                }
                var target = e.target;
                if (winOn) {
                    target.value = winOn +
                        ([16, 17, 18].indexOf(e.keyCode) === -1 ? '+' : '') + // If this is just another special key, don't add a "+"
                            String.fromCharCode(e.keyCode);
                    winOn = false;
                }
                if (!target.value.match(/\\+.$/)) { // Use this block to disallow just special keys or normal keys alone
                    target.value = '';
                }
                e.preventDefault();
            }

            function addListeners (input) {
                input.addEventListener('keydown', keydown);
                input.addEventListener('keypress', keypress);
                input.addEventListener('keyup', keyup);
            }

            var exp;
            if (typeof exports === 'undefined') {
                window.KeySelector = {};
                exp = window.KeySelector;
            }
            else {
                exp = exports;
            }
            exp.addListeners = addListeners;
            return exp;
        }());
      `.replace(/\/\/.*$/mg, '').replace(/\n/g, ''); // Note: manually added an extra backslash in a regex above

      setting.addEventListener('blur', function (e) {
        // We have to manage this ourselves as the preference does not update (why not?)
        e.target.valueToPreference();
      }, true);
      setting.setAttribute(
        'oninputchanged',
          keySelectorCode +
          // "this" has keys: _updatingInput (boolean), input, _observer
          // See http://mxr.mozilla.org/mozilla-central/source/toolkit/mozapps/extensions/content/setting.xml (and http://stackoverflow.com/questions/24471468/how-to-use-addeventlistener-on-inputchanged-of-inline-options/24471723 and https://developer.mozilla.org/en-US/Add-ons/Inline_Options )
          "if (!this.getAttribute('data-hotkey-added')) {this.setAttribute('data-hotkey-added', 'true');KeySelector.addListeners(this.input);}"
      );
      setting.addEventListener('focus', function (e) { // HACK: Better way to get the oninputchanged to fire?
        e.target.input.dispatchEvent(new document.defaultView.KeyboardEvent('input', {key: ''})); // Works!
        // require('sdk/keys').keyEvent(e.target.input, 'input', {key: 'a', window: document.defaultView}); // not working (why not?)
      }, true);
    }
    else if (type === 'radio') {
      let radiogroup = document.createElement('radiogroup');
      for (let { value, label } of options) {
        let radio = document.createElement('radio');
        radio.setAttribute('value', value);
        radio.setAttribute('label', label);
        radiogroup.appendChild(radio);
      }
      setting.appendChild(radiogroup);
    }

    parent.appendChild(setting);
  }
}
exports.injectOptions = injectOptions;
