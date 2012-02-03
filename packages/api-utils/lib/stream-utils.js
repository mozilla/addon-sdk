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

/**
 * Takes `source` stream and distributes it's elements across the readers of
 * the returned stream. Each reader is assigned unique `id` that is returned
 * on registration. Given `attribute` is a key of `source` stream's element
 * that holds `id` associated at most with one registered listener to which
 * given element is passed. If optional `attribute` is not passed it defaults
 * to `id`. Optional `limit` argument is used to limit amount of readers in
 * the registry. By default size of registry is infinite.
 */
exports.distributed = function distributed(source, limit, attribute) {
  let id = 0;
  let nexts = {};
  let stops = {};
  let addresses = [];
  let limit = limit || Infinity;
  attribute = attribute || 'id';

  source(function onElement(element) {
    // For each element of the stream we find an associated element from the
    // listeners stream by looking at the `attribute` property.
    let address = element[attribute];
    let next = nexts[address];
    // If associated listeners is in registry we invoke it. If it no longer
    // wishes to be called (returns `false`), we remove it from the registry.
    if (next && false === next(element)) {
      delete nexts[address];
      delete stops[address];
      addresses.splice(addresses.indexOf(address), 1)
    }
  }, function onStop(reason) {
    // If source stream is stopped we notify all registered handlers and clean
    // up registry.
    Object.keys(stops).forEach(function(address) {
      stops[address](reason);
    });
    stops.splice(0);
    nexts = {};
  });

  // Return stream that can be used to register listeners on the distributed
  // stream.
  return function stream(next, stop) {
    let address = ++id;
    nexts[address] = next;
    if (stop)
      stops[address] = stop;

    addresses.push(address);

    if (addresses.length > limit) {
      let address = addresses.pop();
      delete nexts[address];
      delete stops[address];
    }

    return address;
  };
};
