/* vim:st=2:sts=2:sw=2:
 * ***** BEGIN LICENSE BLOCK *****
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
 *   Brian Warner <warner@mozilla.com>
 *   Erik Vold <erikvvold@gmail.com>
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

const { CC } = require('chrome');
const { jetpackID, name, manifest, metadata, uriPrefix } = require('@packaging');

const XMLHttpRequest = CC('@mozilla.org/xmlextras/xmlhttprequest;1',
                          'nsIXMLHttpRequest');

// Utility function that synchronously reads local resource from the given
// `uri` and returns content string.
function readURI(uri) {
  let request = XMLHttpRequest();
  request.open('GET', uri, false);
  request.overrideMimeType('text/plain');
  request.send();
  return request.responseText;
}

// Some XPCOM APIs require valid URIs as an argument for certain operations (see
// `nsILoginManager` for example). This property represents add-on associated
// unique URI string that can be used for that.
const uri = 'addon:' + jetpackID

function url(root, path) root + (path || "")
function read(root, path) readURI(url(root, path))

exports.create = function create(base) {
  let moduleData = manifest[base] && manifest[base].requirements['self'];
  let root = uriPrefix + moduleData.dataURIPrefix;
  return Object.freeze({
    id: 'self',
    exports: Object.freeze({
      id: jetpackID,
      uri: uri,
      name: name,
      version: metadata[name].version,
      data: {
        url: url.bind(null, root),
        load: read.bind(null, root)
      }
    })
  });
};
