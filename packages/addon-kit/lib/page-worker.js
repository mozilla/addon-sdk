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
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Felipe Gomes <felipc@gmail.com> (Original Author)
 *   Myk Melez <myk@mozilla.org>
 *   Irakli Gozalishvili <gozala@mozilla.com>
 *   Drew Willcoxon <adw@mozilla.com>
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

const { Symbiont } = require("content");
const { Trait } = require("traits");

if (!require("xul-app").isOneOf(["Firefox", "Thunderbird"])) {
  throw new Error([
    "The page-worker module currently supports only Firefox and Thunderbird. ",
    "In the future, we would like it to support other applications, however. ",
    "Please see https://bugzilla.mozilla.org/show_bug.cgi?id=546740 for more ",
    "information."
  ].join(""));
}

const Page = Trait.compose(
  Symbiont.resolve({
    constructor: '_initSymbiont'
  }),
  {
    _frame: Trait.required,
    _initFrame: Trait.required,
    postMessage: Symbiont.required,
    on: Symbiont.required,
    destroy: Symbiont.required,

    constructor: function Page(options) {
      options = options || {};

      this.contentURL = 'contentURL' in options ? options.contentURL
        : 'about:blank';
      if ('contentScriptWhen' in options)
        this.contentScriptWhen = options.contentScriptWhen;
      if ('contentScriptFile' in options)
        this.contentScriptFile = options.contentScriptFile;
      if ('contentScript' in options)
        this.contentScript = options.contentScript;
      if ('allow' in options)
        this.allow = options.allow;
      if ('onError' in options)
        this.on('error', options.onError);
      if ('onMessage' in options)
        this.on('message', options.onMessage);

      this.on('propertyChange', this._onChange.bind(this));

      this._initSymbiont();
    },
    
    _onChange: function _onChange(e) {
      if ('contentURL' in e && this._frame)
        this._initFrame(this._frame);
    }
  }
);
exports.Page = function(options) Page(options);
exports.Page.prototype = Page.prototype;
