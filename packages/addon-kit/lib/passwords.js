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
 *   Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
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

const { Trait } = require("light-traits");
const utils = require("passwords/utils");
const defer = require("utils/function").Enqueued;

/**
 * Utility function that returns `onComplete` and `onError` callbacks form the
 * given `options` objects. Also properties are removed from the passed
 * `options` objects.
 * @param {Object} options
 *    Object that is passed to the exported functions of this module.
 * @returns {Function[]}
 *    Array with two elements `onComplete` and `onError` functions.
 */
function getCallbacks(options) {
  let value = [
    'onComplete' in options ? defer(options.onComplete) : null,
    'onError' in options ? defer(options.onError) : defer(console.exception)
  ];

  delete options.onComplete;
  delete options.onError;

  return value;
};

/**
 * Creates a wrapper function that tries to call `onComplete` with a return
 * value of the wrapped function or falls back to `onError` if wrapped function
 * throws an exception.
 */
function createWrapperMethod(wrapped) {
  return function (options) {
    let [ onComplete, onError ] = getCallbacks(options);
    try {
      onComplete(wrapped(options));
    } catch (exception) {
      onError(exception);
    }
  };
}

exports.search = createWrapperMethod(utils.search);
exports.store = createWrapperMethod(utils.store);
exports.remove = createWrapperMethod(utils.remove);
