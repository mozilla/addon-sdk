/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack Packages.
 *
 * The Initial Developer of the Original Code is Nickolay Ponomarev.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Nickolay Ponomarev <asqueella@gmail.com> (Original Author)
 *   Irakli Gozalishvili <gozala@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
"use strict";

const observers = require("observer-service");
const { Worker, Loader } = require('content');
const { EventEmitter } = require('events');
const { List } = require('list');
const { Registry } = require('utils/registry');
const xulApp = require("xul-app");
const { MatchPattern } = require('match-pattern');

// Whether or not the host application dispatches a document-element-inserted
// notification when the document element is inserted into the DOM of a page.
// The notification was added in Gecko 2.0b6, it's a better time to attach
// scripts with contentScriptWhen "start" than content-document-global-created,
// since libraries like jQuery assume the presence of the document element.
const HAS_DOCUMENT_ELEMENT_INSERTED =
        xulApp.versionInRange(xulApp.platformVersion, "2.0b6", "*");
const ON_CONTENT = HAS_DOCUMENT_ELEMENT_INSERTED ? 'document-element-inserted' :
                   'content-document-global-created';

// Workaround bug 642145: document-element-inserted is fired multiple times.
// This bug is fixed in Firefox 4.0.1, but we want to keep FF 4.0 compatibility
// Tracking bug 641457. To be removed when 4.0 has disappeared from earth.
const HAS_BUG_642145_FIXED =
        xulApp.versionInRange(xulApp.platformVersion, "2.0.1", "*");

// rules registry
const RULES = {};

const Rules = EventEmitter.resolve({ toString: null }).compose(List, {
  add: function() Array.slice(arguments).forEach(function onAdd(rule) {
    if (this._has(rule))
      return;
    // registering rule to the rules registry
    if (!(rule in RULES))
      RULES[rule] = new MatchPattern(rule);
    this._add(rule);
    this._emit('add', rule);
  }.bind(this)),
  remove: function() Array.slice(arguments).forEach(function onRemove(rule) {
    if (!this._has(rule))
      return;
    this._remove(rule);
    this._emit('remove', rule);
  }.bind(this)),
});

/**
 * PageMod constructor (exported below).
 * @constructor
 */
const PageMod = Loader.compose(EventEmitter, {
  on: EventEmitter.required,
  _listeners: EventEmitter.required,
  contentScript: Loader.required,
  contentScriptFile: Loader.required,
  contentScriptWhen: Loader.required,
  include: null,
  constructor: function PageMod(options) {
    this._onContent = this._onContent.bind(this);
    options = options || {};

    if ('contentScript' in options)
      this.contentScript = options.contentScript;
    if ('contentScriptFile' in options)
      this.contentScriptFile = options.contentScriptFile;
    if ('contentScriptWhen' in options)
      this.contentScriptWhen = options.contentScriptWhen;
    if ('onAttach' in options)
      this.on('attach', options.onAttach);
    if ('onError' in options)
      this.on('error', options.onError);

    let include = options.include;
    let rules = this.include = Rules();
    rules.on('add', this._onRuleAdd = this._onRuleAdd.bind(this));
    rules.on('remove', this._onRuleRemove = this._onRuleRemove.bind(this));

    if (Array.isArray(include))
      rules.add.apply(null, include);
    else
      rules.add(include);

    this.on('error', this._onUncaughtError = this._onUncaughtError.bind(this));
    pageModManager.add(this._public);

    this._loadingWindows = [];
  },

  destroy: function destroy() {
    for each (let rule in this.include)
      this.include.remove(rule);
    pageModManager.remove(this._public);
    this._loadingWindows = [];
  },

  _loadingWindows: [],

  _onContent: function _onContent(window) {
    // not registered yet
    if (!pageModManager.has(this))
      return;

    if (!HAS_BUG_642145_FIXED) {
      if (this._loadingWindows.indexOf(window) != -1)
        return;
      this._loadingWindows.push(window);
    }

    if ('start' == this.contentScriptWhen) {
      this._createWorker(window);
      return;
    }

    let eventName = 'end' == this.contentScriptWhen ? 'load' : 'DOMContentLoaded';
    let self = this;
    window.addEventListener(eventName, function onReady(event) {
      if (event.target.defaultView != window)
        return;
      window.removeEventListener(eventName, onReady, true);

      self._createWorker(window);
    }, true);
  },
  _createWorker: function _createWorker(window) {
    let worker = Worker({
      window: window.wrappedJSObject,
      contentScript: this.contentScript,
      contentScriptFile: this.contentScriptFile,
      onError: this._onUncaughtError
    });
    this._emit('attach', worker);
    let self = this;
    worker.once('detach', function detach() {
      worker.destroy();

      if (!HAS_BUG_642145_FIXED) {
        let idx = self._loadingWindows.indexOf(window);
        if (idx != -1)
          self._loadingWindows.splice(idx, 1);
      }
    });
  },
  _onRuleAdd: function _onRuleAdd(url) {
    pageModManager.on(url, this._onContent);
  },
  _onRuleRemove: function _onRuleRemove(url) {
    pageModManager.off(url, this._onContent);
  },
  _onUncaughtError: function _onUncaughtError(e) {
    if (this._listeners('error').length == 1)
      console.exception(e);
  }
});
exports.PageMod = function(options) PageMod(options)
exports.PageMod.prototype = PageMod.prototype;

const PageModManager = Registry.resolve({
  constructor: '_init',
  _destructor: '_registryDestructor'
}).compose({
  constructor: function PageModRegistry(constructor) {
    this._init(PageMod);
    observers.add(
      ON_CONTENT, this._onContentWindow = this._onContentWindow.bind(this)
    );
  },
  _destructor: function _destructor() {
    observers.remove(ON_CONTENT, this._onContentWindow);
    for (let rule in RULES) {
      this._removeAllListeners(rule);
      delete RULES[rule];
    }
    this._registryDestructor();
  },
  _onContentWindow: function _onContentWindow(domObj) {
    let window = HAS_DOCUMENT_ELEMENT_INSERTED ? domObj.defaultView : domObj;
    // XML documents don't have windows, and we don't yet support them.
    if (!window)
      return;
    for (let rule in RULES)
      if (RULES[rule].test(window.document.URL))
        this._emit(rule, window);
  },
  off: function off(topic, listener) {
    this.removeListener(topic, listener);
    if (!this._listeners(topic).length)
      delete RULES[topic];
  }
});
const pageModManager = PageModManager();
