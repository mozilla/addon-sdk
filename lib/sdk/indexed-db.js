/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

module.metadata = {
  "stability": "experimental"
};

const { Cc, Ci } = require('chrome');
const { id } = require('self');

// Injects `indexedDB` to `this` scope.
Cc["@mozilla.org/dom/indexeddb/manager;1"].
getService(Ci.nsIIndexedDatabaseManager).
initWindowless(this);

// Firefox 14 gets this with a prefix
if (typeof(indexedDB) === "undefined")
  this.indexedDB = mozIndexedDB;

// Wrap `indexedDB` methods in order to prefix names
// with add-on IDs. This is temporary workaround for
// Bug 786688. Note: once bug is fixed and prefixing is
// removed existing DBs will appear non-existing.
function prefixWrapper(method) {
  return function(name) {
    let args = [ id + ':' + name ].concat(Array.slice(arguments, 1));
    return method.apply(indexedDB, args);
  }
}
exports.indexedDB = Object.create(indexedDB, {
  open: { value: prefixWrapper(indexedDB.open) },
  deleteDatabase: { value: prefixWrapper(indexedDB.deleteDatabase) }
});
exports.IDBKeyRange = IDBKeyRange;
exports.DOMException = Ci.nsIDOMDOMException;
exports.IDBCursor = Ci.nsIIDBCursor;
exports.IDBTransaction = Ci.nsIIDBTransaction;
exports.IDBOpenDBRequest = Ci.nsIIDBOpenDBRequest;
exports.IDBVersionChangeEvent = Ci.nsIIDBVersionChangeEvent;
exports.IDBDatabase = Ci.nsIIDBDatabase;
exports.IDBFactory = Ci.nsIIDBFactory;
exports.IDBIndex = Ci.nsIIDBIndex;
exports.IDBObjectStore = Ci.nsIIDBObjectStore;
exports.IDBRequest = Ci.nsIIDBRequest;
