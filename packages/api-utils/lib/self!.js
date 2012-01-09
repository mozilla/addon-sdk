/* vim:st=2:sts=2:sw=2:
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
