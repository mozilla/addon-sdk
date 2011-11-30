/* vim:set ts=2 sw=2 sts=2 expandtab */
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
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Irakli Gozalishvili <gozala@mozilla.com> (Original Author)
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

'use strict';

const { Cc, Ci } = require('chrome');
const { get, set, exists } = Cc['@mozilla.org/process/environment;1'].
                             getService(Ci.nsIEnvironment);

exports.env = Proxy.create({
  // XPCOM does not provides a way to enumerate environment variables, so we
  // just don't support enumeration.
  getPropertyNames: function() [],
  getOwnPropertyNames: function() [],
  enumerate: function() [],
  keys: function() [],
  // We do not support freezing, cause it would make it impossible to set new
  // environment variables.
  fix: function() undefined,
  // We present all environment variables as own properties of this object,
  // so we just delegate this call to `getOwnPropertyDescriptor`.
  getPropertyDescriptor: function(name) this.getOwnPropertyDescriptor(name),
  // If environment variable with this name is defined, we generate proprety
  // descriptor for it, otherwise fall back to `undefined` so that for consumer
  // this property does not exists.
  getOwnPropertyDescriptor: function(name) {
    return !exists(name) ? undefined : {
      value: get(name),
      enumerable: false,    // Non-enumerable as we don't support enumeration.
      configurable: true,   // Configurable as it may be deleted.
      writable: true        // Writable as we do support set.
    }
  },

  // New environment variables can be defined just by defining properties
  // on this object.
  defineProperty: function(name, { value }) set(name, value),
  delete: function(name) set(name, null),

  // We present all properties as own, there for we just delegate to `hasOwn`.
  has: function(name) this.hasOwn(name),
  // We do support checks for existence of an environment variable, via `in`
  // operator on this object.
  hasOwn: function(name) exists(name),

  // On property get / set we do read / write appropriate environment variables,
  // please note though, that variables with names of standard object properties
  // intentionally (so that this behaves as normal object) can not be
  // read / set.
  get: function(proxy, name) Object.prototype[name] || get(name) || undefined,
  set: function(proxy, name, value) Object.prototype[name] || set(name, value)
});
