/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

module.metadata = {
  "stability": "unstable"
};

const { Class } = require('../core/heritage');
const { EventTarget } = require('../event/target');
const { emit } = require('../event/core');
const { isValidURI, isLocalURL, URL } = require('../url');
const { contract } = require('../util/contract');
const { isString, isNil, instanceOf } = require('../lang/type');
const { validateOptions,
  string, array, object, either, required } = require('../deprecated/api-utils');

const isJSONable = (value) => {
  try {
    JSON.parse(JSON.stringify(value));
  }
  catch (e) {
    return false;
  }
  return true;
};

const isValidScriptFile = (value) =>
  (isString(value) || instanceOf(value, URL)) && isLocalURL(value);

// map of property validations
const valid = {
  contentURL: {
    is: either(string, object),
    ok: url => isNil(url) || isLocalURL(url) || isValidURI(url),
    msg: 'The `contentURL` option must be a valid URL.'
  },
  contentScriptFile: {
    is: either(string, object, array),
    ok: value => isNil(value) || [].concat(value).every(isValidScriptFile),
    msg: 'The `contentScriptFile` option must be a local URL or an array of URLs.'
  },
  contentScript: {
    is: either(string, array),
    ok: value => isNil(value) || [].concat(value).every(isString),
    msg: 'The `contentScript` option must be a string or an array of strings.'
  },
  contentScriptWhen: {
    is: required(string),
    map: value => value || 'end',
    ok: value => ~['start', 'ready', 'end'].indexOf(value),
    msg: 'The `contentScriptWhen` option must be either "start", "ready" or "end".'
  },
  contentScriptOptions: {
    ok: value => isNil(value) || isJSONable(value),
    msg: 'The contentScriptOptions should be a jsonable value.'
  }
};
exports.validationAttributes = valid;

/**
 * Shortcut function to validate property with validation.
 * @param {Object|Number|String} suspect
 *    value to validate
 * @param {Object} validation
 *    validation rule passed to `api-utils`
 */
function validate(suspect, validation) validateOptions(
  { $: suspect },
  { $: validation }
).$

function Allow(script) ({
  get script() script,
  set script(value) script = !!value
})


// private interface
const allow = Symbol("content/loader/allow");
const contentURL = Symbol("content/loader/contentURL");
const contentScriptWhen = Symbol("content/loader/content-script-when");
const contentScriptOptions = Symbol("content/loader/content-script-options");
const contentScriptFile = Symbol("content/loader/content-script-file");
const contentScript = Symbol("content/loader/content-script-source")
/**
 * Trait is intended to be used in some composition. It provides set of core
 * properties and bounded validations to them. Trait is useful for all the
 * compositions providing high level APIs for interaction with content.
 * Property changes emit `"propertyChange"` events on instances.
 */
const Loader = Class({
  implements: [EventTarget],
  /**
   * Permissions for the content, with the following keys:
   * @property {Object} [allow = { script: true }]
   * @property {Boolean} [allow.script = true]
   *    Whether or not to execute script in the content.  Defaults to true.
   */
  get allow() {
    return this[allow] || (this[allow] = Allow(true))
  },
  set allow(value) {
    this[allow].script = value && value.script;
  },
  [allow]: null,
  /**
   * The content to load. Either a string of HTML or a URL.
   * @type {String}
   */
  get contentURL() {
    return this[contentURL]
  },
  set contentURL(value) {
    value = validate(value, valid.contentURL);
    if (this[contentURL] != value) {
      emit(this, 'propertyChange', {
        contentURL: this[contentURL] = value
      });
    }
  },
  [contentURL]: null,
  /**
   * When to load the content scripts.
   * Possible values are "end" (default), which loads them once all page
   * contents have been loaded, "ready", which loads them once DOM nodes are
   * ready (ie like DOMContentLoaded event), and "start", which loads them once
   * the `window` object for the page has been created, but before any scripts
   * specified by the page have been loaded.
   * Property change emits `propertyChange` event on instance with this key
   * and new value.
   * @type {'start'|'ready'|'end'}
   */
  get contentScriptWhen() {
    return this[contentScriptWhen]
  },
  set contentScriptWhen(value) {
    value = validate(value, valid.contentScriptWhen);
    if (value !== this[contentScriptWhen]) {
      emit(this, 'propertyChange', {
        contentScriptWhen: this[contentScriptWhen] = value
      });
    }
  },
  [contentScriptWhen]: 'end',
  /**
   * Options avalaible from the content script as `self.options`.
   * The value of options can be of any type (object, array, string, etc.)
   * but only jsonable values will be available as frozen objects from the
   * content script.
   * Property change emits `propertyChange` event on instance with this key
   * and new value.
   * @type {Object}
   */
  get contentScriptOptions() {
    return this[contentScriptOptions];
  },
  set contentScriptOptions(value) {
    this[contentScriptOptions] = value;
  },
  [contentScriptOptions]: null,
  /**
   * The URLs of content scripts.
   * Property change emits `propertyChange` event on instance with this key
   * and new value.
   * @type {String[]}
   */
  get contentScriptFile() this[contentScriptFile],
  set contentScriptFile(value) {
    value = validate(value, valid.contentScriptFile);
    if (value != this[contentScriptFile]) {
      emit(this, 'propertyChange', {
        contentScriptFile: this[contentScriptFile] = value
      });
    }
  },
  [contentScriptFile]: null,
  /**
   * The texts of content script.
   * Property change emits `propertyChange` event on instance with this key
   * and new value.
   * @type {String|undefined}
   */
  get contentScript() this[contentScript],
  set contentScript(value) {
    value = validate(value, valid.contentScript);
    if (value != this[contentScript]) {
      emit(this, 'propertyChange', {
        contentScript: this[contentScript] = value
      });
    }
  },
  [contentScript]: null
});
exports.Loader = Loader;

exports.contract = contract(valid);
