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
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
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

const { Cc, Ci, Cr } = require("chrome");

const ios = Cc['@mozilla.org/network/io-service;1'].
            getService(Ci.nsIIOService);

const resProt = ios.getProtocolHandler("resource").
                    QueryInterface(Ci.nsIResProtocolHandler);
const urlParser = Cc['@mozilla.org/network/url-parser;1?auth=maybe'].
                  getService(Ci.nsIURLParser);

/**
 * Take a `url` string, and return an object representation of it.
 */
function parse(href) {
  href = String(href)

  let url = {
    href: { value: null },
    slashes: { value: null },
    scheme: { position: {}, length: {}, value: null },
    // ://
    authority: { position: {}, length: {}, value: null,
      username: { position: {}, length: {}, value: null },
      // :
      password: { position: {}, length: {}, value: null },
      // @
      hostname: { position: {}, length: {}, value: null },
      // :
      port: { value: null }
    },
    path: { position: {}, length: {}, value: null,
      filepath: { position: {}, length: {}, value: null,
        directory: { position: {}, length: {}, value: null },
        basename: { position: {}, length: {}, value: null },
        // .
        extension: { position: {}, length: {}, value: null }
      },
      // ;
      param: { position: {}, length: {}, value: null },
      // ?
      query: { position: {}, length: {}, value: null },
      // #
      ref: { position: {}, length: {}, value: null }
    }
  };

  urlParser.parseURL(
    href,
    href.length,
    url.scheme.position,
    url.scheme.length,
    url.authority.position,
    url.authority.length,
    url.path.position,
    url.path.length);

  url.scheme.value = href.substr(url.scheme.position.value,
                                 url.scheme.length.value).toLowerCase();
  url.slashes.value = href.substr(url.scheme.length.value, 3) === '://';
  url.authority.value = href.substr(url.authority.position.value,
                                    url.authority.length.value);
  url.path.value = href.substr(url.path.position.value,
                               url.path.length.value);

  urlParser.parseAuthority(
    url.authority.value,
    url.authority.length.value,
    url.authority.username.position,
    url.authority.username.length,
    url.authority.password.position,
    url.authority.password.length,
    url.authority.hostname.position,
    url.authority.hostname.length,
    url.authority.port);

  // Normalize URL by lower casing anything that is not a user / password.
  url.href.value = href.toLowerCase().substring(0, url.authority.position.value)
                 + url.authority.value.substring(0, url.authority.hostname.position.value)
                 + url.authority.value.substr(url.authority.hostname.position.value).toLowerCase()
                 + url.path.value;

  url.authority.username.value = url.authority.value.substr(
    url.authority.username.position.value,
    url.authority.username.length.value);
  url.authority.password.value = url.authority.value.substr(
    url.authority.password.position.value,
    url.authority.password.length.value);
  url.authority.hostname.value = url.authority.value.substr(
    url.authority.hostname.position.value,
    url.authority.hostname.length.value).toLowerCase();

  urlParser.parsePath(
    url.path.value,
    url.path.length.value,
    url.path.filepath.position,
    url.path.filepath.length,
    url.path.param.position,
    url.path.param.length,
    url.path.query.position,
    url.path.query.length,
    url.path.ref.position,
    url.path.ref.length);

  url.path.filepath.value = url.path.value.substr(
    url.path.filepath.position.value,
    url.path.filepath.length.value);
  url.path.param.value = url.path.value.substr(
    url.path.param.position.value,
    url.path.param.length.value);
  url.path.query.value = encodeURI(url.path.value.substr(
    url.path.query.position.value,
    url.path.query.length.value));
  url.path.ref.value = url.path.value.substr(
    url.path.ref.position.value,
    url.path.ref.length.value);


  urlParser.parseFilePath(
    url.path.filepath.value,
    url.path.filepath.length.value,
    url.path.filepath.directory.position,
    url.path.filepath.directory.length,
    url.path.filepath.basename.position,
    url.path.filepath.basename.length,
    url.path.filepath.extension.position,
    url.path.filepath.extension.length);

  url.path.filepath.directory.value = url.path.filepath.value.substr(
    url.path.filepath.directory.position.value,
    url.path.filepath.directory.length.value);
  url.path.filepath.basename.value = url.path.filepath.value.substr(
    url.path.filepath.basename.position.value,
    url.path.filepath.basename.length.value);
  url.path.filepath.extension.value = url.path.filepath.value.substr(
    url.path.filepath.extension.position.value,
    url.path.filepath.extension.length.value);

  let value = {};
  value.href = value.spec = url.href.value;
  value.scheme = url.scheme.value;
  value.protocol = value.scheme + ':';
  value.authority = url.authority.value;
  value.hostname = url.authority.hostname.value;
  value.pathname = url.path.filepath.value;
  value.slashes = url.slashes.value;

  // port is set to `-1` if not specified.
  if (~url.authority.port.value)
    value.port = url.authority.port.value;
  if (url.authority.username)
    value.username = url.authority.username.value;
  if (url.authority.password)
    value.password = url.authority.password.value;
  if (value.username || value.password)
    value.auth = value.username + (value.password ? ':' + value.password : '');
  if (value.auth)
    value.userPass = value.auth;

  if (url.path.param.value)
    value.param = url.path.param.value;
  if (url.path.query.value)
    value.query = url.path.query.value;
  if (value.query)
    value.search = '?' + value.query;
  if (url.path.ref.value)
    value.ref = url.path.ref.value;
  if (value.ref)
    value.hash = '#' + value.ref;
  if (url.path.filepath.directory.value)
    value.directory = url.path.filepath.directory.value;
  if (url.path.filepath.basename.value)
    value.basename = url.path.filepath.basename.value;
  if (url.path.filepath.extension.value)
    value.extension = url.path.filepath.extension.value;
  if (value.basename)
    value.filename = value.basename + (value.extension ? '.' + value.extension : '');

  value.path = value.pathname + ('search' in value ? value.search : '');
  value.host = value.hostname + ('port' in value ? ':' + value.port : '');

  return value;
};
exports.parse = parse;

function newURI(uriStr, base) {
  try {
    let baseURI = base ? ios.newURI(base, null, null) : null;
    return ios.newURI(uriStr, null, baseURI);
  }
  catch (e if e.result == Cr.NS_ERROR_MALFORMED_URI) {
    throw new Error("malformed URI: " + uriStr);
  }
  catch (e if (e.result == Cr.NS_ERROR_FAILURE ||
               e.result == Cr.NS_ERROR_ILLEGAL_VALUE)) {
    throw new Error("invalid URI: " + uriStr);
  }
}

function resolveResourceURI(uri) {
  var resolved;
  try {
    resolved = resProt.resolveURI(uri);
  } catch (e if e.result == Cr.NS_ERROR_NOT_AVAILABLE) {
    throw new Error("resource does not exist: " + uri.spec);
  };
  return resolved;
}

let fromFilename = exports.fromFilename = function fromFilename(path) {
  var file = Cc['@mozilla.org/file/local;1']
             .createInstance(Ci.nsILocalFile);
  file.initWithPath(path);
  return ios.newFileURI(file).spec;
};

let toFilename = exports.toFilename = function toFilename(url) {
  var uri = newURI(url);
  if (uri.scheme == "resource")
    uri = newURI(resolveResourceURI(uri));
  if (uri.scheme == "chrome") {
    var channel = ios.newChannelFromURI(uri);
    try {
      channel = channel.QueryInterface(Ci.nsIFileChannel);
      return channel.file.path;
    } catch (e if e.result == Cr.NS_NOINTERFACE) {
      throw new Error("chrome url isn't on filesystem: " + url);
    }
  }
  if (uri.scheme == "file") {
    var file = uri.QueryInterface(Ci.nsIFileURL).file;
    return file.path;
  }
  throw new Error("cannot map to filename: " + url);
};

function URL(url, base) {
  if (!(this instanceof URL)) {
     return new URL(url, base);
  }

  var uri = newURI(url, base);

  var userPass = null;
  try {
    userPass = uri.userPass ? uri.userPass : null;
  } catch (e if e.result == Cr.NS_ERROR_FAILURE) {}

  var host = null;
  try {
    host = uri.host;
  } catch (e if e.result == Cr.NS_ERROR_FAILURE) {}

  var port = null;
  try {
    port = uri.port == -1 ? null : uri.port;
  } catch (e if e.result == Cr.NS_ERROR_FAILURE) {}

  this.__defineGetter__("scheme", function() uri.scheme);
  this.__defineGetter__("userPass", function() userPass);
  this.__defineGetter__("host", function() host);
  this.__defineGetter__("port", function() port);
  this.__defineGetter__("path", function() uri.path);

  Object.defineProperties(this, {
    toString: {
      value: function URL_toString() new String(uri.spec).toString(),
      enumerable: false
    },
    valueOf: {
      value: function() new String(uri.spec).valueOf(),
      enumerable: false
    },
    toSource: {
      value: function() new String(uri.spec).toSource(),
      enumerable: false
    }
  });

  return this;
};

URL.prototype = Object.create(String.prototype);
exports.URL = URL;
